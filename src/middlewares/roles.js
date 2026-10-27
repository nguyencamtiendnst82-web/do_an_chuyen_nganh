import * as authorizeModule from './authorize.js';

/**
 * authorize(...roles): chỉ cho phép các vai trò được liệt kê, còn lại trả 403.
 * File này chỉ re-export để các route mới dùng một cách import thống nhất,
 * bất kể authorize.js xuất dạng default hay named.
 */
const authorize =
  typeof authorizeModule.default === 'function'
    ? authorizeModule.default
    : authorizeModule.authorize;

export { authorize };
export default authorize;
