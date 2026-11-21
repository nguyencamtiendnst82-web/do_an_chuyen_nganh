import { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { formatVND, errorMessage } from '../utils/format';
import invoiceApi from '../api/invoiceApi';
import { useToast } from './Feedback';
import { useAuth } from '../contexts/AuthContext';

const CreateInvoiceModal = ({ appointment, onClose, onSuccess }) => {
  const toast = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [surcharges, setSurcharges] = useState([]);
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [preview, setPreview] = useState(null); // { promotion, staff_max_discount_percent }

  // Bước 3: hệ thống tự tìm khuyến mãi đang áp dụng
  useEffect(() => {
    let alive = true;
    invoiceApi.previewInvoice(appointment.id)
      .then((res) => { if (alive) setPreview(res.data.data); })
      .catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
  }, [appointment.id]);

  // Dịch vụ của lịch hẹn
  const services = appointment?.details || [];
  const servicesSubtotal = useMemo(() => {
    return services.reduce((sum, s) => sum + (Number(s.price_at_booking) || 0), 0);
  }, [services]);

  // Tổng phụ phí
  const surchargesTotal = useMemo(() => {
    return surcharges.reduce((sum, s) => {
      const qty = Number(s.quantity) || 1;
      const price = Number(s.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  }, [surcharges]);

  const grossTotal = servicesSubtotal + surchargesTotal;
  const promoDiscount = Number(preview?.promotion?.discount) || 0;
  const discountValue = Math.max(0, Number(discount) || 0);
  const maxPercent = preview?.staff_max_discount_percent ?? 20;
  const isStaff = user?.role_name === 'staff';
  // Bước 5: nhân viên vượt hạn mức -> hóa đơn chờ admin duyệt, chưa trừ phần giảm thủ công
  const needsApproval = isStaff && discountValue > 0 && discountValue * 100 > (grossTotal - promoDiscount) * maxPercent;
  const grandTotal = grossTotal - promoDiscount - (needsApproval ? 0 : discountValue);

  const handleAddSurcharge = () => {
    setSurcharges((prev) => [
      ...prev,
      { item_name: '', quantity: 1, unit_price: '' },
    ]);
  };

  const handleRemoveSurcharge = (index) => {
    setSurcharges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSurchargeChange = (index, field, value) => {
    setSurcharges((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate phụ phí client-side
    for (let i = 0; i < surcharges.length; i++) {
      const s = surcharges[i];
      if (!s.item_name?.trim()) {
        setError(`Vui lòng nhập tên cho phụ phí thứ ${i + 1}.`);
        return;
      }
      const qty = Number(s.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError(`Số lượng phụ phí thứ ${i + 1} phải là số nguyên dương.`);
        return;
      }
      const price = Number(s.unit_price);
      if (isNaN(price) || price < 0) {
        setError(`Đơn giá phụ phí thứ ${i + 1} không được âm.`);
        return;
      }
    }

    if (discountValue > 0) {
      if (!discountReason.trim()) {
        setError('Vui lòng nhập lý do giảm giá.');
        return;
      }
      if (promoDiscount + discountValue >= grossTotal) {
        setError('Số tiền giảm giá phải nhỏ hơn tổng tiền hóa đơn.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        notes: notes.trim() || null,
        discount_amount: discountValue,
        discount_reason: discountValue > 0 ? discountReason.trim() : null,
        surcharges: surcharges.map((s) => ({
          item_name: s.item_name.trim(),
          quantity: Number(s.quantity) || 1,
          unit_price: Number(s.unit_price) || 0,
        })),
      };

      const res = await invoiceApi.createForAppointment(appointment.id, payload);
      toast.success('Lập hóa đơn thành công!');
      onSuccess?.(res.data.data.invoice);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Không thể lập hóa đơn.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Lập hóa đơn thanh toán" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100">
          <div className="flex justify-between">
            <span className="text-gray-500">Mã lịch hẹn:</span>
            <span className="font-mono font-medium text-gray-900">{appointment?.appointment_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Khách hàng:</span>
            <span className="font-medium text-gray-900">{appointment?.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Thú cưng:</span>
            <span className="font-medium text-gray-900">{appointment?.pet_name}</span>
          </div>
        </div>

        {/* Danh sách dịch vụ gốc */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Dịch vụ đã thực hiện</h4>
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {services.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 text-sm bg-white">
                <div>
                  <p className="font-medium text-gray-800">{item.service_name || item.item_name}</p>
                  <p className="text-xs text-gray-400">{item.duration_minutes ? `${item.duration_minutes} phút` : ''}</p>
                </div>
                <span className="font-medium text-gray-900">{formatVND(item.price_at_booking)}</span>
              </div>
            ))}
            <div className="flex justify-between p-3 text-sm bg-gray-50 font-medium">
              <span>Tạm tính dịch vụ</span>
              <span className="text-gray-900">{formatVND(servicesSubtotal)}</span>
            </div>
          </div>
        </div>

        {/* Phụ phí tùy chỉnh */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Phụ phí phát sinh (nếu có)</h4>
              <p className="text-xs text-gray-500">Ví dụ: gỡ rối lông nặng, phụ thu ngoài giờ, xử lý ve rận...</p>
            </div>
            <button
              type="button"
              onClick={handleAddSurcharge}
              className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              + Thêm phụ phí
            </button>
          </div>

          {surcharges.length === 0 ? (
            <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg text-center border border-dashed border-gray-200">
              Chưa có phụ phí phát sinh nào.
            </p>
          ) : (
            <div className="space-y-2">
              {surcharges.map((item, idx) => {
                const rowTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                return (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm">
                    <input
                      type="text"
                      placeholder="Tên phụ phí..."
                      value={item.item_name}
                      onChange={(e) => handleSurchargeChange(idx, 'item_name', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="SL"
                      value={item.quantity}
                      onChange={(e) => handleSurchargeChange(idx, 'quantity', e.target.value)}
                      className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Đơn giá"
                      value={item.unit_price}
                      onChange={(e) => handleSurchargeChange(idx, 'unit_price', e.target.value)}
                      className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="w-24 text-right font-medium text-xs text-gray-700">
                      {formatVND(rowTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSurcharge(idx)}
                      className="text-red-500 hover:text-red-700 p-1 text-sm rounded transition"
                      title="Xóa phụ phí"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Giảm giá */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Giảm giá (nếu có)</h4>
          <p className="text-xs text-gray-500 mb-2">Chỉ dùng cho dịp đặc biệt. Nhân viên tự giảm tối đa {maxPercent}%; vượt mức này hóa đơn sẽ chờ quản trị viên duyệt.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="number" min="0" step="1000" value={discount} onChange={(e) => setDiscount(e.target.value)}
              placeholder="Số tiền giảm (đ)" aria-label="Số tiền giảm giá"
              className="sm:w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" maxLength={150} value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="Lý do (VD: khách thân thiết, khuyến mãi tháng 11)" aria-label="Lý do giảm giá"
              disabled={discountValue <= 0}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
          </div>
        </div>

        {needsApproval && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2" role="status">
            Mức giảm vượt {maxPercent}% nên cần quản trị viên duyệt. Hóa đơn sẽ được tạo ở trạng thái chờ duyệt và chưa thu tiền được cho đến khi có kết quả.
          </div>
        )}

        {/* Ghi chú */}
        <div>
          <label htmlFor="invoice-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Ghi chú hóa đơn (tùy chọn)
          </label>
          <textarea
            id="invoice-notes"
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú thêm cho khách hàng hoặc nội bộ..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tổng kết tiền */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Tiền dịch vụ:</span>
            <span>{formatVND(servicesSubtotal)}</span>
          </div>
          {surchargesTotal > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Phụ phí:</span>
              <span>+{formatVND(surchargesTotal)}</span>
            </div>
          )}
          {promoDiscount > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>Khuyến mãi tự động ({preview.promotion.name}):</span>
              <span>−{formatVND(promoDiscount)}</span>
            </div>
          )}
          {discountValue > 0 && (
            <div className={`flex justify-between ${needsApproval ? 'text-amber-700' : 'text-rose-600'}`}>
              <span>Giảm giá thủ công{needsApproval ? ' (chờ duyệt)' : ''}:</span>
              <span>{needsApproval ? formatVND(discountValue) : `−${formatVND(discountValue)}`}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-blue-900 pt-2 border-t border-blue-200">
            <span>Tổng cộng thanh toán:</span>
            <span>{formatVND(grandTotal)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? 'Đang tạo...' : 'Tạo hóa đơn'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateInvoiceModal;

