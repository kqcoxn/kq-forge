---
name: pytorch-patterns
type: capability
package: ai-ml
description: PyTorch 开发模式，涵盖 Dataset/DataLoader、模型架构（nn.Module）、训练循环、混合精度（AMP）、分布式训练基础、检查点、调试技巧与常见陷阱。
---

# PyTorch 开发模式

## 核心原则

1. **显式优于隐式** — PyTorch 的命令式风格让调试直观
2. **模块化设计** — 模型、数据、训练逻辑分离
3. **内存感知** — 理解计算图和梯度累积对显存的影响
4. **可复现性** — 固定随机种子、确定性算法
5. **渐进优化** — 先跑通，再优化速度和显存

## Dataset 与 DataLoader

```python
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path

class TextClassificationDataset(Dataset):
    """自定义数据集：实现 __len__ 和 __getitem__"""

    def __init__(self, data_path: Path, tokenizer, max_length: int = 512):
        self.samples = self._load_data(data_path)
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        text, label = self.samples[idx]
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(label, dtype=torch.long),
        }

    def _load_data(self, path: Path) -> list[tuple[str, int]]:
        # 数据加载逻辑
        ...

# DataLoader 配置
train_loader = DataLoader(
    train_dataset,
    batch_size=32,
    shuffle=True,
    num_workers=4,          # 多进程数据加载
    pin_memory=True,        # 加速 CPU→GPU 传输
    drop_last=True,         # 丢弃不完整的最后一个 batch
    persistent_workers=True, # 保持 worker 进程存活
)
```

## 模型架构（nn.Module）

```python
import torch.nn as nn
import torch.nn.functional as F

class TransformerClassifier(nn.Module):
    def __init__(self, vocab_size: int, d_model: int = 256,
                 nhead: int = 8, num_layers: int = 4, num_classes: int = 10):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = nn.Parameter(torch.randn(1, 512, d_model))

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=0.1, activation="gelu", batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.classifier = nn.Sequential(
            nn.LayerNorm(d_model),
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(d_model, num_classes),
        )

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        x = self.embedding(input_ids) + self.pos_encoding[:, :input_ids.size(1)]
        # 转换 attention_mask 为 transformer 格式
        src_key_padding_mask = ~attention_mask.bool()
        x = self.encoder(x, src_key_padding_mask=src_key_padding_mask)
        # 取 [CLS] 位置或平均池化
        x = x.mean(dim=1)  # 平均池化
        return self.classifier(x)

# 权重初始化
def init_weights(module: nn.Module):
    if isinstance(module, nn.Linear):
        nn.init.xavier_uniform_(module.weight)
        if module.bias is not None:
            nn.init.zeros_(module.bias)
    elif isinstance(module, nn.Embedding):
        nn.init.normal_(module.weight, std=0.02)

model = TransformerClassifier(vocab_size=30000)
model.apply(init_weights)
```

## 训练循环

```python
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

def train(model, train_loader, val_loader, config):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    optimizer = AdamW(model.parameters(), lr=config.lr, weight_decay=0.01)
    scheduler = CosineAnnealingLR(optimizer, T_max=config.epochs)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    best_val_loss = float("inf")

    for epoch in range(config.epochs):
        # 训练阶段
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}

            optimizer.zero_grad()
            logits = model(batch["input_ids"], batch["attention_mask"])
            loss = criterion(logits, batch["labels"])
            loss.backward()

            # 梯度裁剪防止梯度爆炸
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_loss += loss.item()

        scheduler.step()

        # 验证阶段
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)

        print(f"Epoch {epoch+1}: train_loss={total_loss/len(train_loader):.4f}, "
              f"val_loss={val_loss:.4f}, val_acc={val_acc:.4f}")

        # 保存最佳模型
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            save_checkpoint(model, optimizer, epoch, val_loss, "best_model.pt")

@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        logits = model(batch["input_ids"], batch["attention_mask"])
        loss = criterion(logits, batch["labels"])
        total_loss += loss.item()
        correct += (logits.argmax(dim=-1) == batch["labels"]).sum().item()
        total += batch["labels"].size(0)
    return total_loss / len(loader), correct / total
```

## 混合精度训练（AMP）

```python
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

for batch in train_loader:
    optimizer.zero_grad()

    # 自动混合精度：前向传播使用 FP16
    with autocast():
        logits = model(batch["input_ids"], batch["attention_mask"])
        loss = criterion(logits, batch["labels"])

    # 缩放梯度防止 FP16 下溢
    scaler.scale(loss).backward()
    scaler.unscale_(optimizer)
    nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)
    scaler.update()
```

## 分布式训练基础

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler

def setup_distributed(rank, world_size):
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def train_distributed(rank, world_size, config):
    setup_distributed(rank, world_size)

    model = TransformerClassifier(...).to(rank)
    model = DDP(model, device_ids=[rank])

    sampler = DistributedSampler(train_dataset, num_replicas=world_size, rank=rank)
    train_loader = DataLoader(train_dataset, sampler=sampler, batch_size=config.batch_size)

    for epoch in range(config.epochs):
        sampler.set_epoch(epoch)  # 确保每个 epoch 数据打乱不同
        train_one_epoch(model, train_loader, optimizer)

    dist.destroy_process_group()

# 启动：torchrun --nproc_per_node=4 train.py
```

## 检查点

```python
def save_checkpoint(model, optimizer, epoch, loss, path):
    torch.save({
        "epoch": epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "loss": loss,
        "config": model.config,  # 保存模型配置用于重建
    }, path)

def load_checkpoint(path, model, optimizer=None):
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    model.load_state_dict(checkpoint["model_state_dict"])
    if optimizer:
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
    return checkpoint["epoch"], checkpoint["loss"]
```

## 调试技巧

```python
# 1. 梯度检查：验证自定义层的梯度计算
from torch.autograd import gradcheck
input = torch.randn(3, 4, requires_grad=True, dtype=torch.double)
assert gradcheck(custom_function, input)

# 2. 钩子：检查中间层输出和梯度
activations = {}
def hook_fn(name):
    def hook(module, input, output):
        activations[name] = output.detach()
    return hook
model.encoder.register_forward_hook(hook_fn("encoder"))

# 3. 检测异常值
torch.autograd.set_detect_anomaly(True)  # 定位 NaN 产生位置

# 4. 过拟合单个 batch 验证模型能力
small_batch = next(iter(train_loader))
for i in range(100):
    loss = train_step(model, small_batch)
    if i % 10 == 0:
        print(f"Step {i}: loss={loss:.4f}")  # 应趋近于 0
```

## 常见陷阱

```python
# 陷阱1：忘记 model.eval() 和 torch.no_grad()
# BatchNorm 和 Dropout 在 train/eval 模式行为不同
model.eval()
with torch.no_grad():
    predictions = model(test_input)

# 陷阱2：数据泄露 — 在整个数据集上做归一化后再划分
# 正确：只在训练集上 fit，transform 应用到验证/测试集

# 陷阱3：学习率过高导致 loss 为 NaN
# 使用 lr finder 或从 1e-4 开始

# 陷阱4：GPU 显存泄漏 — 在循环中累积计算图
total_loss += loss.item()  # .item() 脱离计算图
# 错误：total_loss += loss  # 保持计算图，显存持续增长

# 陷阱5：多 GPU 时保存模型
# DDP 包装后要用 model.module.state_dict()
torch.save(model.module.state_dict(), "model.pt")
```

## 检查清单

- [ ] Dataset 实现 `__len__` 和 `__getitem__`，支持索引访问
- [ ] DataLoader 配置 `num_workers > 0` 和 `pin_memory=True`
- [ ] 模型继承 `nn.Module`，所有参数通过子模块注册
- [ ] 训练循环包含：`zero_grad → forward → loss → backward → step`
- [ ] 使用梯度裁剪防止梯度爆炸
- [ ] 验证时使用 `model.eval()` + `torch.no_grad()`
- [ ] 混合精度训练用于加速和节省显存
- [ ] 定期保存检查点，包含模型和优化器状态
- [ ] 固定随机种子确保可复现性
- [ ] 先在单个 batch 上过拟合验证模型正确性
