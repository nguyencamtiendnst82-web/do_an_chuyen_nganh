import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from './Modal';
import { formatVND, errorMessage } from '../utils/format';
import { formatDate, hm } from '../utils/appointment';
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_STYLE, PAYMENT_METHOD_LABEL } from '../utils/invoice';
import invoiceApi from '../api/invoiceApi';
import { useAuth } from '../contexts/AuthContext';
import PaymentModal from './PaymentModal';

const SPA = {
  address: '538 Tôn Đức Thắng, P. Hòa Khánh, Đà Nẵng',
  phone: '0338 919 227',
};

const TX_STATUS = {
  success: { label: 'Thành công', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Chờ xử lý', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Thất bại', style: 'bg-red-50 text-red-700 border-red-200' },
};

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
          .then((qrRes) => setVietqrUrl(qrRes.data.data.qr_url || qrRes.data.data.vietqr_url))
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
  const discount = Number(invoice?.discount_amount) || 0;
  const surchargeTotal = details
    .filter((d) => d.service_id === null)
    .reduce((sum, d) => sum + Number(d.total_price || 0), 0);
  const remaining = Math.max(0, totalAmount - totalPaid);

  const [deciding, setDeciding] = useState(false);
  const isAdmin = user?.role_name === 'admin';
  const pendingApproval = invoice?.approval_status === 'pending';

  const decide = async (approve) => {
    setDeciding(true);
    setError('');
    try {
      await invoiceApi.decideDiscount(invoiceId, approve);
      await loadInvoice();
      onUpdated?.();
    } catch (err) {
      setError(errorMessage(err, 'Không xử lý được yêu cầu giảm giá.'));
    } finally {
      setDeciding(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    loadInvoice();
    onUpdated?.();
  };

  // In bằng một bản sao hóa đơn gắn thẳng vào <body>; CSS in ẩn (display: none) toàn bộ phần còn lại,
  // nên chỉ ra đúng 1 trang (không dùng visibility vì phần ẩn vẫn chiếm chỗ và sinh thêm trang trắng).
  const handlePrint = () => {
    const source = document.getElementById('invoice-print');
    if (!source) return;
    const copy = document.createElement('div');
    copy.id = 'invoice-print-root';
    copy.innerHTML = source.innerHTML;
    document.body.appendChild(copy);
    window.addEventListener('afterprint', () => copy.remove(), { once: true });
    window.print();
  };

  return (
    <>
      <Modal title="Chi tiết hóa đơn" onClose={onClose} width="max-w-2xl">
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
          <div id="invoice-print" className="space-y-5 text-sm text-gray-900">
            {/* Tiêu đề: thương hiệu + mã hóa đơn */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-gray-900">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">🐾</span>
                  <div>
                    <p className="text-lg font-bold text-gray-900 leading-tight">Pet Spa</p>
                    <p className="text-[11px] text-gray-500">Dịch vụ chăm sóc & làm đẹp thú cưng</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-600 mt-2">📍 {SPA.address}</p>
                <p className="text-[11px] text-gray-600">📞 {SPA.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Hóa đơn dịch vụ</p>
                <p className="text-base font-bold font-mono text-gray-900 break-all">{invoice.invoice_code}</p>
                <p className="text-xs text-gray-500">Ngày lập: {formatDate(invoice.created_at)}</p>
                <span
                  className={`inline-flex items-center mt-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold border ${
                    PAYMENT_STATUS_STYLE[invoice.payment_status] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[invoice.payment_status] || invoice.payment_status}
                </span>
              </div>
            </div>

            {pendingApproval && (
              <div className="print:hidden bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-900 space-y-2" role="status">
                <p>
                  <strong>Đang chờ quản trị viên duyệt giảm giá {formatVND(invoice.pending_discount)}</strong>
                  {invoice.manual_discount_reason ? ` – lý do: ${invoice.manual_discount_reason}` : ''}. Chưa thể thu tiền.
                </p>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button type="button" disabled={deciding} onClick={() => decide(true)} className="px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">Duyệt giảm giá</button>
                    <button type="button" disabled={deciding} onClick={() => decide(false)} className="px-3 py-1.5 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-60">Từ chối</button>
                  </div>
                )}
              </div>
            )}

            {/* Thông tin khách hàng & lịch hẹn */}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs bg-gray-50 rounded-lg p-3">
              <div>
                <dt className="text-gray-500">Khách hàng</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">{invoice.customer_name}</dd>
                {invoice.customer_phone && <dd className="text-gray-600">{invoice.customer_phone}</dd>}
              </div>
              <div>
                <dt className="text-gray-500">Thú cưng</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">{invoice.pet_name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Mã lịch hẹn</dt>
                <dd className="font-mono font-semibold text-gray-900 mt-0.5">{invoice.appointment_code}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Nhân viên thực hiện</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">{invoice.employee_name || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Thời gian sử dụng dịch vụ</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">
                  {hm(invoice.start_time)} – {hm(invoice.end_time)}, ngày {formatDate(String(invoice.appointment_date || ''))}
                </dd>
              </div>
            </dl>

            {/* Bảng chi tiết dịch vụ & phụ phí */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase tracking-wide text-[10px]">
                  <th className="text-left font-semibold px-3 py-2 w-8">#</th>
                  <th className="text-left font-semibold px-3 py-2">Khoản mục</th>
                  <th className="text-center font-semibold px-3 py-2">SL</th>
                  <th className="text-right font-semibold px-3 py-2">Đơn giá</th>
                  <th className="text-right font-semibold px-3 py-2">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-b border-gray-200">
                {details.map((item, idx) => {
                  const isSurcharge = item.service_id === null;
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-gray-900">{item.item_name}</span>
                        {isSurcharge && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                            Phụ phí
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{formatVND(item.unit_price)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-900 tabular-nums">{formatVND(item.total_price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Tổng hợp tài chính (căn phải) */}
            <div className="flex justify-end">
              <div className="w-full sm:w-72 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính dịch vụ</span>
                  <span className="tabular-nums">{formatVND(invoice.subtotal)}</span>
                </div>
                {surchargeTotal > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Phụ phí</span>
                    <span className="tabular-nums">{formatVND(surchargeTotal)}</span>
                  </div>
                )}
                <div className={`flex justify-between ${discount > 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                  <span>Giảm giá{invoice.promotion_name && Number(invoice.promotion_discount) > 0 ? ` (${invoice.promotion_name})` : ''}</span>
                  <span className="tabular-nums">{discount > 0 ? `− ${formatVND(discount)}` : formatVND(0)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-300 text-base">
                  <span>Tổng cộng</span>
                  <span className="tabular-nums">{formatVND(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Đã thanh toán</span>
                  <span className="tabular-nums">− {formatVND(totalPaid)}</span>
                </div>
                <div className={`flex justify-between font-bold px-3 py-2 rounded-lg ${remaining > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  <span>Còn lại phải trả</span>
                  <span className="tabular-nums">{formatVND(remaining)}</span>
                </div>
              </div>
            </div>

            {/* Lịch sử thanh toán */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Lịch sử thanh toán</h4>
              {payments.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg text-center border border-dashed border-gray-200">
                  Chưa có giao dịch thanh toán nào được ghi nhận.
                </p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-500 text-[10px] uppercase tracking-wide border-b border-gray-200">
                      <th className="text-left font-semibold py-1.5">Mã giao dịch</th>
                      <th className="text-left font-semibold py-1.5">Phương thức</th>
                      <th className="text-left font-semibold py-1.5">Ngày</th>
                      <th className="text-left font-semibold py-1.5">Trạng thái</th>
                      <th className="text-right font-semibold py-1.5">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((p, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-mono text-gray-800">{p.payment_code}{p.notes && <span className="block text-[11px] text-gray-500 italic font-sans">{p.notes}</span>}</td>
                        <td className="py-2 text-gray-600">{PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method}</td>
                        <td className="py-2 text-gray-600">{formatDate(p.payment_time)}</td>
                        <td className="py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${(TX_STATUS[p.status] || {}).style || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {(TX_STATUS[p.status] || {}).label || p.status}
                          </span>
                        </td>
                        <td className="py-2 text-right font-semibold text-emerald-700 tabular-nums">{formatVND(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Khách hàng: Hiển thị VietQR để quét thanh toán */}
            {!isStaffOrAdmin && remaining > 0 && !pendingApproval && (
              <div className="print:hidden p-4 bg-gradient-to-br from-pink-50 to-pink-50 border border-pink-200 rounded-2xl text-center space-y-3">
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

            <div className="text-center pt-4 border-t border-dashed border-gray-300">
              <p className="text-sm font-semibold text-gray-900">Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của Pet Spa!</p>
              <p className="text-xs text-gray-500 mt-0.5">Rất hân hạnh được đồng hành cùng bé yêu của bạn trong những lần chăm sóc tiếp theo 🐾</p>
            </div>

            {/* Actions footer */}
            <div className="print:hidden flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              >
                🖨 In / Lưu PDF
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Đóng
                </button>

                {isStaffOrAdmin && remaining > 0 && !pendingApproval && (
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
