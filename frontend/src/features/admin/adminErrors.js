export function getAdminError(error, { forMutation = false } = {}) {
  const status = error?.response?.status;
  const cancelled = error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
  const body = error?.response?.data;
  const validation = status === 400 && body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  const fieldErrors = Object.fromEntries(Object.entries(validation).filter(([, value]) => typeof value === 'string' && value.trim()));
  const uncertain = forMutation && !status && !cancelled;
  const message = uncertain
    ? 'Chưa xác định được kết quả lưu. Hãy tải lại danh sách hoặc kiểm tra dữ liệu trước khi gửi lại.'
    : body?.message || (!status ? 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.'
      : status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
      : status === 409 ? 'Dữ liệu bị xung đột. Vui lòng kiểm tra và thử lại.' : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.');
  return { status, fieldErrors, message, uncertain, cancelled };
}

export function retryAdminQuery(failureCount, error) {
  if (error?.code === 'ERR_CANCELED') return false;
  const status = error?.response?.status;
  return failureCount < 1 && (!status || status >= 500);
}
