---
name: mle-workflow
type: capability
package: ai-ml
description: 机器学习工程工作流，涵盖项目生命周期（问题定义、数据、建模、评估、部署）、实验追踪（MLflow/W&B）、特征工程、模型版本管理、A/B 测试与监控（数据漂移、模型退化）。
---

# 机器学习工程工作流

## 核心原则

1. **问题先行** — 先明确业务目标和成功指标，再选择技术方案
2. **数据为王** — 数据质量决定模型上限，投入 80% 精力在数据上
3. **实验可复现** — 每次实验的代码、数据、参数、结果都可追溯
4. **渐进迭代** — 从简单基线开始，逐步增加复杂度
5. **持续监控** — 模型上线不是终点，持续监控性能退化

## 项目生命周期

```
1. 问题定义
   ├── 业务目标 → ML 目标映射
   ├── 成功指标定义（离线指标 + 在线指标）
   ├── 基线确定（规则系统 / 简单模型 / 人工表现）
   └── 可行性评估（数据可用性、标注成本、延迟要求）

2. 数据准备
   ├── 数据收集与清洗
   ├── 探索性数据分析（EDA）
   ├── 特征工程
   ├── 数据版本管理（DVC）
   └── 训练/验证/测试集划分

3. 模型开发
   ├── 基线模型
   ├── 实验迭代（超参搜索、架构探索）
   ├── 模型评估（离线指标）
   └── 误差分析

4. 模型部署
   ├── 模型打包（ONNX / TorchScript / SavedModel）
   ├── 服务化（REST API / gRPC / 批处理）
   ├── A/B 测试
   └── 全量上线

5. 持续监控
   ├── 数据漂移检测
   ├── 模型性能监控
   ├── 自动告警
   └── 定期重训练
```

## 实验追踪（MLflow）

```python
import mlflow
from mlflow.tracking import MlflowClient

# 设置实验
mlflow.set_experiment("推荐系统-v2")

with mlflow.start_run(run_name="xgboost-baseline"):
    # 记录参数
    params = {
        "n_estimators": 500,
        "max_depth": 6,
        "learning_rate": 0.1,
        "subsample": 0.8,
    }
    mlflow.log_params(params)

    # 训练模型
    model = XGBClassifier(**params)
    model.fit(X_train, y_train)

    # 记录指标
    y_pred = model.predict(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred, average="weighted"),
        "auc": roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]),
    }
    mlflow.log_metrics(metrics)

    # 记录模型
    mlflow.xgboost.log_model(model, "model")

    # 记录产物（混淆矩阵、特征重要性图等）
    mlflow.log_artifact("confusion_matrix.png")
    mlflow.log_artifact("feature_importance.json")

# 模型注册与版本管理
client = MlflowClient()
client.create_registered_model("recommender-v2")
client.create_model_version(
    name="recommender-v2",
    source=f"runs:/{run_id}/model",
    run_id=run_id,
)
# 阶段晋升：Staging → Production
client.transition_model_version_stage("recommender-v2", version=3, stage="Production")
```

## Weights & Biases 追踪

```python
import wandb

wandb.init(
    project="text-classification",
    config={
        "model": "bert-base-chinese",
        "epochs": 10,
        "batch_size": 32,
        "lr": 2e-5,
    },
)

for epoch in range(config.epochs):
    train_loss = train_one_epoch(model, train_loader)
    val_metrics = evaluate(model, val_loader)

    wandb.log({
        "epoch": epoch,
        "train/loss": train_loss,
        "val/accuracy": val_metrics["accuracy"],
        "val/f1": val_metrics["f1"],
    })

    # 记录预测样本
    wandb.log({"predictions": wandb.Table(
        columns=["text", "true_label", "pred_label", "confidence"],
        data=sample_predictions,
    )})

wandb.finish()
```

## 特征工程模式

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

# 特征管道：可复现、可序列化
numeric_features = ["age", "income", "purchase_count"]
categorical_features = ["city", "device_type", "channel"]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", Pipeline([
            ("scaler", StandardScaler()),
        ]), numeric_features),
        ("cat", Pipeline([
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical_features),
    ]
)

# 时间特征
def extract_time_features(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """从时间戳提取周期性特征"""
    df[f"{col}_hour"] = df[col].dt.hour
    df[f"{col}_dayofweek"] = df[col].dt.dayofweek
    df[f"{col}_is_weekend"] = df[col].dt.dayofweek >= 5
    # 周期性编码
    df[f"{col}_hour_sin"] = np.sin(2 * np.pi * df[f"{col}_hour"] / 24)
    df[f"{col}_hour_cos"] = np.cos(2 * np.pi * df[f"{col}_hour"] / 24)
    return df
```

## 模型版本管理（DVC）

```yaml
# dvc.yaml — 数据管道定义
stages:
  prepare:
    cmd: python src/prepare.py
    deps:
      - src/prepare.py
      - data/raw/
    outs:
      - data/processed/

  train:
    cmd: python src/train.py
    deps:
      - src/train.py
      - data/processed/
    params:
      - train.epochs
      - train.lr
    outs:
      - models/model.pt
    metrics:
      - metrics.json:
          cache: false

  evaluate:
    cmd: python src/evaluate.py
    deps:
      - src/evaluate.py
      - models/model.pt
      - data/processed/test/
    metrics:
      - eval_metrics.json:
          cache: false
    plots:
      - plots/confusion_matrix.png
```

## A/B 测试

```python
# A/B 测试框架
class ABTest:
    def __init__(self, experiment_name: str, traffic_split: float = 0.1):
        self.name = experiment_name
        self.split = traffic_split  # 实验组流量比例

    def assign_variant(self, user_id: str) -> str:
        """确定性分组：同一用户始终在同一组"""
        hash_val = int(hashlib.md5(f"{self.name}:{user_id}".encode()).hexdigest(), 16)
        return "treatment" if (hash_val % 100) < self.split * 100 else "control"

    def log_exposure(self, user_id: str, variant: str):
        """记录曝光事件"""
        analytics.track("ab_exposure", {
            "experiment": self.name,
            "variant": variant,
            "user_id": user_id,
        })

# 统计显著性检验
from scipy import stats

def check_significance(control_conversions, control_total,
                       treatment_conversions, treatment_total,
                       alpha=0.05):
    """双比例 z 检验"""
    p1 = control_conversions / control_total
    p2 = treatment_conversions / treatment_total
    z_stat, p_value = stats.proportions_ztest(
        [control_conversions, treatment_conversions],
        [control_total, treatment_total],
    )
    return {"p_value": p_value, "significant": p_value < alpha, "lift": (p2 - p1) / p1}
```

## 监控（数据漂移与模型退化）

```python
from evidently import ColumnMapping
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset, TargetDriftPreset

# 数据漂移检测
def detect_drift(reference_data: pd.DataFrame, current_data: pd.DataFrame):
    report = Report(metrics=[DataDriftPreset(), TargetDriftPreset()])
    report.run(reference_data=reference_data, current_data=current_data)

    drift_results = report.as_dict()
    if drift_results["metrics"][0]["result"]["dataset_drift"]:
        alert("数据漂移检测到！需要重新训练模型")

# 模型性能监控
def monitor_model_performance():
    """定期评估模型在最新数据上的表现"""
    recent_predictions = get_recent_predictions(days=7)
    recent_labels = get_ground_truth(days=7)

    current_metrics = calculate_metrics(recent_predictions, recent_labels)
    baseline_metrics = load_baseline_metrics()

    # 性能下降超过阈值时告警
    if current_metrics["auc"] < baseline_metrics["auc"] * 0.95:
        alert(f"模型 AUC 下降: {baseline_metrics['auc']:.4f} → {current_metrics['auc']:.4f}")
```

## 检查清单

- [ ] 业务目标与 ML 指标有明确映射关系
- [ ] 数据集有版本管理（DVC / Delta Lake）
- [ ] 每次实验记录：代码版本、数据版本、超参数、指标
- [ ] 有简单基线模型作为对比参照
- [ ] 特征工程管道可序列化、可复现
- [ ] 模型注册中心管理版本和阶段（Staging/Production）
- [ ] 上线前通过 A/B 测试验证在线效果
- [ ] 数据漂移检测定期运行
- [ ] 模型性能监控仪表盘可用
- [ ] 重训练触发条件和流程已定义
