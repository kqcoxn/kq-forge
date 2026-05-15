---
name: benchmark
type: capability
package: performance
description: 基准测试方法论，涵盖预热、统计显著性、环境控制，各语言工具（Benchmark.js、pytest-benchmark、Go bench、Criterion.rs），负载测试（k6、Artillery），性能剖析（火焰图、Chrome DevTools）与报告格式。
---

# 基准测试实践

## 核心原则

1. **科学方法** — 控制变量、多次采样、统计验证
2. **环境隔离** — 排除干扰因素，结果可重现
3. **贴近真实** — 基准测试场景反映实际工作负载
4. **持续追踪** — 基准结果纳入 CI，检测性能回归
5. **理解噪声** — 区分真实差异和测量噪声

## 基准测试方法论

```
1. 预热（Warmup）
   - JIT 编译器需要预热才能达到稳态性能
   - 缓存需要填充到稳定状态
   - 通常预热 3-5 次迭代后再开始计时

2. 采样与统计
   - 最少运行 30 次获得统计意义
   - 报告中位数（不受极端值影响）和 P95
   - 计算标准差，变异系数 > 5% 说明结果不稳定
   - 使用 t 检验或 Mann-Whitney U 检验比较两组结果

3. 环境控制
   - 固定 CPU 频率（禁用 turbo boost）
   - 关闭不必要的后台进程
   - 使用相同硬件/容器规格
   - 记录环境信息（OS、CPU、内存、编译器版本）

4. 避免常见陷阱
   - 编译器死代码消除（确保结果被使用）
   - 缓存效应（冷启动 vs 热缓存分别测量）
   - GC 暂停（报告包含/排除 GC 的结果）
```

## JavaScript — Benchmark.js / Vitest bench

```javascript
// vitest.config.ts 中启用 bench
import { bench, describe } from 'vitest';

describe('字符串拼接', () => {
  const items = Array.from({ length: 1000 }, (_, i) => `item_${i}`);

  bench('Array.join', () => {
    items.join(', ');
  });

  bench('模板字符串 reduce', () => {
    items.reduce((acc, item) => `${acc}, ${item}`);
  });

  bench('+= 拼接', () => {
    let result = '';
    for (const item of items) result += item + ', ';
  });
});

// 运行：vitest bench
// 输出包含 ops/sec、平均时间、P75/P99
```

## Python — pytest-benchmark

```python
import pytest
from myapp.search import linear_search, binary_search

# 基础基准测试
def test_linear_search_benchmark(benchmark):
    data = list(range(10000))
    result = benchmark(linear_search, data, 9999)
    assert result == 9999

def test_binary_search_benchmark(benchmark):
    data = list(range(10000))
    result = benchmark(binary_search, data, 9999)
    assert result == 9999

# 带预热和轮次配置
def test_heavy_computation(benchmark):
    benchmark.pedantic(
        heavy_function,
        args=(large_dataset,),
        iterations=10,      # 每轮迭代次数
        rounds=50,          # 总轮次
        warmup_rounds=5     # 预热轮次
    )

# 分组比较
@pytest.mark.parametrize("size", [100, 1000, 10000])
def test_sort_performance(benchmark, size):
    data = list(range(size, 0, -1))
    benchmark.group = f"sort-{size}"
    benchmark(sorted, data)

# 运行：pytest --benchmark-only --benchmark-compare
# 保存基线：pytest --benchmark-save=baseline
# 对比：pytest --benchmark-compare=0001_baseline
```

## Go — testing.B

```go
package search

import "testing"

// 基础基准测试
func BenchmarkLinearSearch(b *testing.B) {
    data := make([]int, 10000)
    for i := range data {
        data[i] = i
    }
    target := 9999

    b.ResetTimer() // 排除 setup 时间
    for i := 0; i < b.N; i++ {
        LinearSearch(data, target)
    }
}

// 子基准测试：不同规模
func BenchmarkSort(b *testing.B) {
    sizes := []int{100, 1000, 10000}
    for _, size := range sizes {
        b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
            for i := 0; i < b.N; i++ {
                b.StopTimer()
                data := generateRandom(size)
                b.StartTimer()
                sort.Ints(data)
            }
        })
    }
}

// 内存分配基准
func BenchmarkStringConcat(b *testing.B) {
    b.ReportAllocs() // 报告内存分配
    for i := 0; i < b.N; i++ {
        var builder strings.Builder
        for j := 0; j < 100; j++ {
            builder.WriteString("hello")
        }
        _ = builder.String()
    }
}

// 运行：go test -bench=. -benchmem -count=5
// 对比：benchstat old.txt new.txt
```

## Rust — Criterion.rs

```rust
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn fibonacci(n: u64) -> u64 {
    match n {
        0 | 1 => n,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn bench_fibonacci(c: &mut Criterion) {
    let mut group = c.benchmark_group("fibonacci");

    for size in [10, 15, 20, 25].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            size,
            |b, &size| b.iter(|| fibonacci(size)),
        );
    }
    group.finish();
}

// 吞吐量基准
fn bench_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse");
    let input = include_str!("../testdata/large.json");

    group.throughput(criterion::Throughput::Bytes(input.len() as u64));
    group.bench_function("serde_json", |b| {
        b.iter(|| serde_json::from_str::<Value>(input).unwrap())
    });
    group.finish();
}

criterion_group!(benches, bench_fibonacci, bench_throughput);
criterion_main!(benches);
// 运行：cargo bench
// 输出 HTML 报告到 target/criterion/
```

## 负载测试 — k6

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // 爬坡
    { duration: '3m', target: 50 },   // 稳态
    { duration: '1m', target: 200 },  // 压力
    { duration: '2m', target: 200 },  // 持续压力
    { duration: '1m', target: 0 },    // 冷却
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/users');
  check(res, {
    '状态码 200': (r) => r.status === 200,
    '响应时间 < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(res.status !== 200);
  latency.add(res.timings.duration);
  sleep(1);
}

// 运行：k6 run load-test.js
// 输出到 Grafana：k6 run --out influxdb=http://localhost:8086/k6 load-test.js
```

## 性能剖析

```bash
# 火焰图（Linux perf）
perf record -g ./my_program
perf script | stackcollapse-perf.pl | flamegraph.pl > flamegraph.svg

# Go pprof
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/profile?seconds=30

# Node.js
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Python
python -m cProfile -o output.prof my_script.py
# 可视化：snakeviz output.prof
```

## 报告格式

```markdown
# 性能基准报告

## 环境
- 硬件：8 核 CPU, 32GB RAM, NVMe SSD
- OS：Ubuntu 22.04
- 运行时：Node.js 20.11, Go 1.22
- 日期：2024-01-15

## 结果摘要

| 场景 | P50 | P95 | P99 | 吞吐量 | 对比基线 |
|------|-----|-----|-----|--------|---------|
| API /users | 12ms | 45ms | 120ms | 2500 rps | -15% |
| API /orders | 25ms | 80ms | 200ms | 1200 rps | +5% |

## 回归分析
- /users P95 从 38ms 升至 45ms（+18%），原因：新增字段序列化
- 建议：对新字段使用懒加载

## 结论与建议
1. ...
```

## 检查清单

- [ ] 基准测试包含预热阶段，排除冷启动影响
- [ ] 每个基准至少运行 30 次，报告中位数和 P95
- [ ] 环境信息记录完整（硬件、OS、运行时版本）
- [ ] 使用统计方法验证差异显著性（非直觉判断）
- [ ] 负载测试覆盖爬坡、稳态、压力三个阶段
- [ ] 性能阈值定义明确（P95 < Xms）
- [ ] 基准结果保存为基线，CI 中自动对比
- [ ] 火焰图用于定位热点函数
- [ ] 报告包含可操作的优化建议
- [ ] 定期（每周/每次发布）运行基准测试
