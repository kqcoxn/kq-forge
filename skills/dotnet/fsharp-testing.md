---
name: fsharp-testing
type: capability
package: dotnet
description: F# 测试实践，涵盖 Expecto 框架、FsCheck 属性测试、计算表达式测试、类型驱动开发测试模式与项目组织。
---

# F# 测试实践

## 核心原则

1. **属性优于示例** — 用属性测试覆盖输入空间，示例测试验证关键场景
2. **类型即约束** — 利用类型系统消除非法状态，减少需要测试的路径
3. **纯函数易测** — 无副作用的函数只需验证输入输出映射
4. **组合式测试** — 利用计算表达式组合测试逻辑
5. **快速反馈** — Expecto 支持并行执行和 watch 模式

## Expecto 基础

```fsharp
open Expecto

// 单个测试
let simpleTest = test "加法基本验证" {
    let result = Calculator.add 2 3
    Expect.equal result 5 "2 + 3 应等于 5"
}

// 测试列表
let calculatorTests = testList "Calculator" [
    test "加法正数" {
        Expect.equal (Calculator.add 1 2) 3 ""
    }
    test "除零抛出异常" {
        Expect.throws
            (fun () -> Calculator.divide 10 0 |> ignore)
            "除零应抛出异常"
    }
    test "负数乘法" {
        Expect.equal (Calculator.multiply (-2) 3) (-6) ""
    }
]

// 异步测试
let asyncTests = testList "异步操作" [
    testAsync "获取用户数据" {
        let! user = UserService.getByIdAsync 42
        Expect.isSome user "用户应存在"
        Expect.equal user.Value.Name "Alice" ""
    }
    testAsync "超时处理" {
        let! result = Async.Catch (UserService.fetchWithTimeout 100)
        Expect.isError result "应超时失败"
    }
]

// 入口点
[<EntryPoint>]
let main args =
    runTestsWithCLIArgs [] args (testList "All" [
        calculatorTests
        asyncTests
    ])
```

## Expecto 断言与工具

```fsharp
open Expecto

let assertionExamples = testList "断言示例" [
    test "数值比较" {
        Expect.equal 42 42 "相等"
        Expect.notEqual 1 2 "不等"
        Expect.isGreaterThan 10 5 "大于"
        Expect.floatClose Accuracy.medium 3.14 3.14159 "浮点近似"
    }
    test "集合断言" {
        Expect.containsAll [1;2;3] [1;2] "包含子集"
        Expect.isEmpty [] "空列表"
        Expect.hasLength [1;2;3] 3 "长度为3"
    }
    test "字符串断言" {
        Expect.stringContains "hello world" "world" "包含子串"
        Expect.stringStarts "hello" "hel" "前缀匹配"
    }
    test "Option/Result 断言" {
        Expect.isSome (Some 42) "应为 Some"
        Expect.isNone None "应为 None"
        Expect.isOk (Ok 1) "应为 Ok"
        Expect.isError (Error "fail") "应为 Error"
    }
]
```

## FsCheck 属性测试

```fsharp
open FsCheck
open Expecto

// 基础属性测试
let propertyTests = testList "属性测试" [
    testProperty "列表反转两次等于原列表" <| fun (xs: int list) ->
        List.rev (List.rev xs) = xs

    testProperty "排序后列表有序" <| fun (xs: int list) ->
        let sorted = List.sort xs
        sorted |> List.pairwise |> List.forall (fun (a, b) -> a <= b)

    testProperty "序列化往返一致" <| fun (user: User) ->
        let json = serialize user
        let deserialized = deserialize<User> json
        deserialized = user
]

// 自定义生成器
type PositiveInt = PositiveInt of int

let positiveIntGen =
    Gen.choose (1, 10000) |> Gen.map PositiveInt

type Generators =
    static member PositiveInt() =
        { new Arbitrary<PositiveInt>() with
            member _.Generator = positiveIntGen }

let configWithGenerators =
    { FsCheckConfig.defaultConfig with arbitrary = [typeof<Generators>] }

let customGenTests = testList "自定义生成器" [
    testPropertyWithConfig configWithGenerators "正整数除法不为零"
    <| fun (PositiveInt a) (PositiveInt b) ->
        let result = a / b
        result >= 0
]

// 条件属性（前置条件过滤）
let conditionalTests = testList "条件属性" [
    testProperty "非空列表有头元素" <| fun (xs: int list) ->
        not (List.isEmpty xs) ==> lazy (
            List.head xs = xs.[0]
        )
]
```

## 类型驱动开发测试

```fsharp
// 利用类型系统使非法状态不可表示
// 这样测试只需关注合法路径

// 受限类型：编译期保证有效性
type EmailAddress = private EmailAddress of string
module EmailAddress =
    let create (s: string) =
        if s.Contains("@") && s.Contains(".")
        then Ok (EmailAddress s)
        else Error "无效邮箱格式"
    let value (EmailAddress e) = e

// 状态机：类型保证状态转换合法
type UnverifiedEmail = UnverifiedEmail of EmailAddress
type VerifiedEmail = VerifiedEmail of EmailAddress

type EmailVerification =
    | Unverified of UnverifiedEmail
    | Verified of VerifiedEmail

// 只需测试状态转换函数
let verificationTests = testList "邮箱验证" [
    test "有效 token 验证成功" {
        let email = EmailAddress.create "test@example.com" |> Result.get
        let unverified = UnverifiedEmail email
        let result = verifyEmail unverified "valid-token"
        Expect.isOk result "应验证成功"
    }
    test "无效 token 验证失败" {
        let email = EmailAddress.create "test@example.com" |> Result.get
        let unverified = UnverifiedEmail email
        let result = verifyEmail unverified "bad-token"
        Expect.isError result "应验证失败"
    }
]
```

## 计算表达式测试

```fsharp
// 测试 Result 计算表达式
let resultCETests = testList "Result CE" [
    test "全部成功时返回 Ok" {
        let workflow = result {
            let! a = Ok 1
            let! b = Ok 2
            return a + b
        }
        Expect.equal workflow (Ok 3) ""
    }
    test "中途失败短路" {
        let workflow = result {
            let! a = Ok 1
            let! _ = Error "中断"
            return a + 999  // 不会执行
        }
        Expect.equal workflow (Error "中断") ""
    }
]

// 测试异步工作流
let asyncCETests = testList "Async CE" [
    testAsync "管道组合" {
        let pipeline = async {
            let! data = fetchDataAsync "source"
            let transformed = transform data
            let! saved = saveAsync transformed
            return saved
        }
        let! result = pipeline
        Expect.isTrue result.Success ""
    }
]
```

## 测试组织与配置

```fsharp
// 测试过滤与标签
let taggedTests = testList "带标签测试" [
    testList "快速" [
        test "单元测试1" { Expect.isTrue true "" }
    ] |> testSequenced  // 顺序执行

    ptestList "跳过的测试" [  // p 前缀 = pending
        test "尚未实现" { failtest "TODO" }
    ]

    ftestList "聚焦测试" [  // f 前缀 = focused（仅运行这些）
        test "调试中" { Expect.isTrue true "" }
    ]
]

// 性能测试
let perfTests = testList "性能" [
    testCase "排序性能" <| fun () ->
        let data = [1..10000] |> List.rev
        Expect.isFasterThan
            (fun () -> List.sort data |> ignore)
            (fun () -> bubbleSort data |> ignore)
            "内置排序应更快"
]
```

## 项目结构

```
MyProject/
├── src/
│   └── MyProject/
│       ├── Domain.fs          # 领域类型
│       ├── Services.fs        # 业务逻辑
│       └── MyProject.fsproj
├── tests/
│   └── MyProject.Tests/
│       ├── Domain.Tests.fs    # 领域测试
│       ├── Services.Tests.fs  # 服务测试
│       ├── Properties.fs      # 属性测试
│       ├── Generators.fs      # 自定义生成器
│       ├── TestHelpers.fs     # 共享工具
│       ├── Program.fs         # 入口点
│       └── MyProject.Tests.fsproj
└── MyProject.sln
```

```xml
<!-- MyProject.Tests.fsproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <OutputType>Exe</OutputType>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Expecto" Version="10.*" />
    <PackageReference Include="Expecto.FsCheck" Version="10.*" />
    <PackageReference Include="FsCheck" Version="3.*" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="../../src/MyProject/MyProject.fsproj" />
  </ItemGroup>
</Project>
```

## 检查清单

- [ ] 使用 Expecto 作为测试框架，支持并行和 watch 模式
- [ ] 核心业务逻辑使用 FsCheck 属性测试覆盖
- [ ] 自定义生成器处理领域特定类型
- [ ] 利用类型系统减少需要测试的非法状态路径
- [ ] 纯函数直接测试输入输出，副作用函数隔离测试
- [ ] 测试文件顺序与源文件对应（F# 文件顺序敏感）
- [ ] 使用 `testAsync` 测试异步工作流
- [ ] 性能关键路径使用 `Expect.isFasterThan` 回归
- [ ] CI 中运行 `dotnet run -- --summary` 输出测试报告
- [ ] 属性测试至少运行 100 次迭代（默认配置）
