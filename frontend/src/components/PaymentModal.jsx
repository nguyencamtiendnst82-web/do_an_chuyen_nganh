import { useState, useEffect } from 'react';
import Modal from './Modal';
import { formatVND, errorMessage } from '../utils/format';
import { PAYMENT_METHOD_LABEL } from '../utils/invoice';
import invoiceApi from '../api/invoiceApi';
import { useToast } from './Feedback';

const PaymentModal = ({ invoice, onClose, onSuccess }) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = Number(invoice?.total_amount) || 0;
  // Tính tổng đã thanh toán từ danh sách payments nếu có
  const existingPayments = invoice?.payments || [];
  const totalPaid = existingPayments.reduce(
    (sum, p) => (p.status === 'success' ? sum + Number(p.amount) : sum),
    0
  );
  const remaining = Math.max(0, totalAmount - totalPaid);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState(remaining > 0 ? remaining : '');
  const [notes, setNotes] = useState('');
  const [vietqrData, setVietqrData] = useState(null);

  // Khi chọn bank_transfer, tự động lấy VietQR
  useEffect(() => {
    if (paymentMethod === 'bank_transfer' && invoice?.id && !vietqrData) {
      setLoadingQR(true);
      invoiceApi
        .getVietQR(invoice.id)
        .then((res) => {
          setVietqrData(res.data.data);
        })
        .catch((err) => {
          // Nếu đã thanh toán đủ thì getVietQR có thể trả 400
          console.warn('Không tải được VietQR:', err);
        })
        .finally(() => {
          setLoadingQR(false);
        });
    }
  }, [paymentMethod, invoice?.id, vietqrData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 1000) {
      setError('Số tiền thanh toán tối thiểu là 1.000đ.');
      return;
    }
    if (numericAmount > remaining) {
      setError(`Số tiền thanh toán không được vượt quá số tiền còn lại (${formatVND(remaining)}).`);
      return;
    }

    setSubmitting(true);
    try {
      await invoiceApi.recordPayment(invoice.id, {
        amount: numericAmount,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
      });

      toast.success('Ghi nhận thanh toán thành công!');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Không thể ghi nhận thanh toán.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Ghi nhận thanh toán" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Thông tin hóa đơn */}
        <div className="bg-gray-50 rounded-xl p-3.5 space-y-1.5 text-sm border border-gray-100">
          <div className="flex justify-between">
            <span className="text-gray-500">Mã hóa đơn:</span>
            <span className="font-mono font-semibold text-gray-900">{invoice?.invoice_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Khách hàng:</span>
            <span className="font-medium text-gray-800">{invoice?.customer_name}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
            <span className="text-gray-600">Tổng tiền hóa đơn:</span>
            <span className="font-semibold text-gray-900">{formatVND(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Đã thanh toán:</span>
            <span className="text-emerald-600 font-medium">{formatVND(totalPaid)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-blue-900 border-t border-dashed border-gray-300 pt-1.5">
            <span>Còn lại cần thu:</span>
            <span className="text-red-600">{formatVND(remaining)}</span>
          </div>
        </div>

        {/* Chọn phương thức thanh toán */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phương thức thanh toán
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPaymentMethod(key)}
                className={`p-2.5 rounded-xl border text-sm font-medium text-left transition ${
                  paymentMethod === key
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Khu vực VietQR minh họa nếu chọn bank_transfer */}
        {paymentMethod === 'bank_transfer' && (
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-center space-y-2">
            <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
              Mã QR thanh toán VietQR (Minh họa)
            </p>
            {loadingQR ? (
              <div className="h-44 flex items-center justify-center text-sm text-gray-500">
                Đang tạo mã VietQR...
              </div>
            ) : vietqrData?.vietqr_url ? (
              <div className="inline-block p-2 bg-white rounded-xl shadow-sm border border-blue-100">
                <img
                  src={vietqrData.vietqr_url}
                  alt="VietQR Payment Code"
                  className="w-48 h-48 mx-auto object-contain"
                />
                <p className="text-xs font-mono text-gray-600 mt-1">
                  Nội dung CK: <strong className="text-gray-900">{invoice?.invoice_code}</strong>
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Không tải được ảnh mã QR.</p>
            )}
            <p className="text-xs text-blue-700">
              * Khách hàng quét mã bằng ứng dụng ngân hàng hoặc ví điện tử.
            </p>
          </div>
        )}

        {/* Số tiền thanh toán */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-700">
              Số tiền thu (VNĐ)
            </label>
            {remaining > 0 && Number(amount) !== remaining && (
              <button
                type="button"
                onClick={() => setAmount(remaining)}
                className="text-xs text-blue-600 hover:underline"
              >
                Điền đủ ({formatVND(remaining)})
              </button>
            )}
          </div>
          <input
            id="pay-amount"
            type="number"
            min="1000"
            max={remaining}
            step="1000"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Ghi chú */}
        <div>
          <label htmlFor="pay-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Ghi chú giao dịch (tùy chọn)
          </label>
          <input
            id="pay-notes"
            type="text"
            maxLength={255}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Số tham chiếu, mã GD ngân hàng, POS ID..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={submitting || remaining <= 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? 'Đang xử lý...' : `Xác nhận thu ${amount ? formatVND(Number(amount)) : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PaymentModal;

