/**
 * 统一的 IPC 响应类型（共享模块）
 *
 * 主进程所有 invoke handler 的返回值都应采用此结构，
 * 渲染层据此做 `success` 分支判断，避免散落的 `{ success; error? }` 内联断言。
 *
 * - 无数据载荷的 handler：`IpcResult`
 * - 带数据的 handler：`IpcResult<T>`，成功时附带 `data: T`
 */

export type IpcResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };
