export function parseVNPayReturn(search) {
  if (!search || search.length > 8192) throw new Error('Đường dẫn kết quả thanh toán không hợp lệ.');
  const result = {};
  for (const [key, value] of new URLSearchParams(search)) {
    if (!key.startsWith('vnp_')) continue;
    if (Object.hasOwn(result, key) || key.length > 64 || value.length > 2048)
      throw new Error('Đường dẫn kết quả thanh toán có tham số không hợp lệ.');
    result[key] = value;
  }
  if (Object.keys(result).length > 32 || !/^[a-zA-Z0-9]{1,100}$/.test(result.vnp_TxnRef ?? '')
      || !/^[a-fA-F0-9]{128}$/.test(result.vnp_SecureHash ?? '') || !/^\d{1,12}$/.test(result.vnp_Amount ?? '')
      || !/^\d{2}$/.test(result.vnp_ResponseCode ?? '') || !/^\d{2}$/.test(result.vnp_TransactionStatus ?? '')
      || !result.vnp_TmnCode)
    throw new Error('Đường dẫn thiếu thông tin kết quả từ VNPay.');
  return result;
}

export function resultIsFinal(result) {
  return ['SUCCESS', 'FAILED', 'REFUND_REQUIRED', 'REFUNDED'].includes(result?.paymentStatus)
    || ['SUCCESS', 'FAILED', 'REFUND_REQUIRED', 'REFUNDED'].includes(result?.attemptStatus);
}

// This function receives only the response verified by our backend, never raw URL parameters.
export function paymentResultView(result) {
  const { booking, paymentStatus, attemptStatus, gatewayResponseCode: response, gatewayTransactionStatus: transaction } = result;
  if ([paymentStatus, attemptStatus].includes('REFUND_REQUIRED'))
    return { kind: 'review', title: 'Giao dịch cần được hỗ trợ', message: 'Hệ thống đã ghi nhận khoản thanh toán cần xử lý hoàn tiền. Vui lòng lưu mã đơn và liên hệ hỗ trợ; không thanh toán lại.' };
  if ([paymentStatus, attemptStatus].includes('REFUNDED'))
    return { kind: 'review', title: 'Giao dịch đã được hoàn tiền', message: 'Hệ thống đã ghi nhận hoàn tiền cho giao dịch này.' };
  if (booking.status === 'CONFIRMED' && paymentStatus === 'SUCCESS')
    return { kind: 'success', title: 'Đặt vé thành công', message: 'Thanh toán đã được xác nhận. Thông tin vé của bạn được lưu trong đơn đặt vé bên dưới.' };
  if (response === '00' && transaction === '00')
    return { kind: 'pending', title: 'VNPay đã ghi nhận thanh toán', message: 'Đang chờ hệ thống xác nhận vé. Bạn không cần thanh toán lại. Nếu chờ lâu, vui lòng lưu mã đơn và liên hệ hỗ trợ.' };
  if (response === '24')
    return { kind: 'cancelled', title: 'Bạn đã hủy thanh toán tại VNPay', message: 'Bạn có thể xem lại trạng thái đơn đặt vé. Thao tác hủy tại VNPay không tự hủy lượt giữ ghế trong hệ thống.' };
  if (attemptStatus === 'FAILED' || transaction === '02'
      || ['09', '10', '11', '12', '13', '51', '65', '75', '79'].includes(response))
    return { kind: 'failed', title: 'Thanh toán chưa thành công', message: 'Giao dịch chưa hoàn tất. Vui lòng kiểm tra trạng thái đơn trước khi thử thanh toán lại.' };
  return { kind: 'pending', title: 'Đang xác minh kết quả thanh toán', message: 'Chưa có kết quả cuối cùng cho giao dịch này. Vui lòng kiểm tra lại sau; không tạo thêm giao dịch khi chưa rõ kết quả.' };
}
