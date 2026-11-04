import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from './Modal';
import { formatVND, errorMessage } from '../utils/format';
import { formatDate } from '../utils/appointment';
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_STYLE, PAYMENT_METHOD_LABEL } from '../utils/invoice';
import invoiceApi from '../api/invoiceApi';
import { useAuth } from '../contexts/AuthContext';
import PaymentModal from './PaymentModal';

const InvoiceDetailModal = ({ invoiceId, onClose, onUpdated }) => {
  const { user } = useAuth();
  const isStaffOrAdmin = ['staff', 'admin'].includes(user?.role_name);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [vietqrUrl, setVietqrUrl] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError('');
    try {
      const res = await invoiceApi.getInvoice(invoiceId);
      const data = res.data.data.invoice;
      setInvoice(data);

      // Nếu còn dư nợ, lấy link VietQR minh họa
      const totalAmount = Number(data.total_amount) || 0;
      const totalPaid = (data.payments || []).reduce(
        (sum, p) => (p.status === 'success' ? sum + Number(p.amount) : sum),
        0
      );
      if (totalAmount > totalPaid) {
        setLoadingQR(true);
        invoiceApi
          .getVietQR(invoiceId)
          .then((qrRes) => setVietqrUrl(qrRes.data.data.vietqr_url))
          .catch(() => setVietqrUrl(''))
          .finally(() => setLoadingQR(false));
      } else {
        setVietqrUrl('');
      }
    } catch (err) {
      setError(errorMessage(err, 'Không thể tải thông tin hóa đơn.'));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const payments = invoice?.payments || [];
  const details = invoice?.details || [];

  const totalPaid = useMemo(() => {
    return payments.reduce(
      (sum, p) => (p.status === 'success' ? sum + Number(p.amount) : sum),
      0
    );
  }, [payments]);

  const totalAmount = Number(invoice?.total_amount) || 0;
  const remaining = Math.max(0, totalAmount - totalPaid);

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    loadInvoice();
    onUpdated?.();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Modal title="Chi tiết hóa đơn" onClose={onClose}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4 py-6" aria-busy="true">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : invoice ? (
          <div className="space-y-5 text-sm print:text-black">
            {/* Header hóa đơn */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Mã hóa đơn</span>
                <h3 className="text-xl font-bold font-mono text-gray-900">{invoice.invoice_code}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ngày lập: {formatDate(invoice.created_at)} · Lịch hẹn: <span className="font-mono">{invoice.appointment_code}</span>
                </p>
              </div>
              <div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                    PAYMENT_STATUS_STYLE[invoice.payment_status] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[invoice.payment_status] || invoice.payment_status}
                </span>
              </div>
            </div>

            {/* Thông tin khách hàng & thú cưng */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div>
                <span className="text-xs text-gray-500 block">Khách hàng:</span>
                <span className="font-semibold text-gray-900">{invoice.customer_name}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Thú cưng:</span>
                <span className="font-semibold text-gray-900">{invoice.pet_name}</span>
              </div>
            </div>

            {/* Bảng chi tiết dịch vụ & phụ phí */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Chi tiết khoản thu</h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 grid grid-cols-12">
                  <div className="col-span-6">Khoản mục</div>
                  <div className="col-span-2 text-center">SL</div>
                  <div className="col-span-2 text-right">Đơn giá</div>
                  <div className="col-span-2 text-right">Thành tiền</div>
                </div>

                {details.map((item, idx) => {
                  const isSurcharge = item.service_id === null;
                  return (
                    <div key={idx} className="px-3 py-2.5 text-xs grid grid-cols-12 items-center bg-white">
                      <div className="col-span-6">
                        <span className="font-medium text-gray-900">{item.item_name}</span>
                        {isSurcharge && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                            Phụ phí
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-center text-gray-600">{item.quantity}</div>
                      <div className="col-span-2 text-right text-gray-600">{formatVND(item.unit_price)}</div>
                      <div className="col-span-2 text-right font-medium text-gray-900">{formatVND(item.total_price)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tổng hợp tài chính */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 border border-gray-200">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính dịch vụ:</span>
                <span>{formatVND(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tổng cộng hóa đơn:</span>
                <span className="font-semibold text-gray-900">{formatVND(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Đã thanh toán:</span>
                <span className="font-semibold">{formatVND(totalPaid)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                <span>Còn lại phải trả:</span>
                <span className={remaining > 0 ? 'text-red-600' : 'text-emerald-700'}>
                  {formatVND(remaining)}
                </span>
              </div>
            </div>

            {/* Lịch sử thanh toán */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Lịch sử thanh toán</h4>
              {payments.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg text-center border border-dashed border-gray-200">
                  Chưa có giao dịch thanh toán nào được ghi nhận.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden text-xs">
                  {payments.map((p, idx) => (
                    <div key={idx} className="p-3 bg-white flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <span className="font-mono font-medium text-gray-800">{p.payment_code}</span>
                        <div className="text-gray-500 text-[11px] mt-0.5">
                          {PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method} · {formatDate(p.payment_time)}
                        </div>
                        {p.notes && <p className="text-gray-600 text-[11px] mt-0.5 italic">"{p.notes}"</p>}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-emerald-600 text-sm">{formatVND(p.amount)}</span>
                        <div className="text-[10px] text-gray-400 uppercase">{p.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Khách hàng: Hiển thị VietQR để quét thanh toán */}
            {!isStaffOrAdmin && remaining > 0 && (
              <div className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-2xl text-center space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-pink-900">Quét mã VietQR để thanh toán</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Mở ứng dụng Ngân hàng hoặc Ví MoMo để quét mã thanh toán cho đơn hàng này.
                  </p>
                </div>

                {loadingQR ? (
                  <div className="h-44 flex items-center justify-center text-xs text-gray-400">
                    Đang tạo mã QR...
                  </div>
                ) : vietqrUrl ? (
                  <div className="inline-block p-2 bg-white rounded-xl shadow border border-pink-100">
                    <img src={vietqrUrl} alt="VietQR" className="w-52 h-52 mx-auto object-contain" />
                    <p className="text-xs font-mono font-medium text-gray-700 mt-1">
                      Nội dung CK: <strong className="text-pink-700">{invoice.invoice_code}</strong>
                    </p>
                  </div>
                ) : null}

                <div className="text-xs text-gray-500 max-w-sm mx-auto">
                  Số tiền thanh toán: <strong className="text-gray-900">{formatVND(remaining)}</strong>. Sau khi chuyển khoản, nhân viên spa sẽ đối soát và cập nhật trạng thái.
                </div>
              </div>
            )}

            {invoice.notes && (
              <div className="text-xs bg-gray-50 rounded-lg p-3 border border-gray-100">
                <span className="font-semibold text-gray-600 block mb-0.5">Ghi chú:</span>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            {/* Actions footer */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              >
                🖨 In hóa đơn
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Đóng
                </button>

                {isStaffOrAdmin && remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
                  >
                    + Thu tiền ({formatVND(remaining)})
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Sub-modal ghi nhận thanh toán */}
      {showPaymentModal && invoice && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
};

export default InvoiceDetailModal;
