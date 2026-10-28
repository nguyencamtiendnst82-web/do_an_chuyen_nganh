import { useCallback, useEffect, useState } from 'react';
import shiftApi from '../../api/shiftApi';
import { CardSkeleton } from '../../components/Skeleton';
import { useToast } from '../../components/Feedback';
import { errorMessage } from '../../utils/format';

/**
 * Format string YYYY-MM-DD -> DD/MM/YYYY
 */
const formatDateVN = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

const getWeekdayName = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  return WEEKDAY_NAMES[d.getUTCDay()];
};

const MyShiftsPage = () => {
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: '', to: '' });

  const loadMyShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shiftApi.getMyShifts();
      setShifts(res.data.data.records);
      setRange({ from: res.data.data.from, to: res.data.data.to });
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể tải lịch ca làm việc của bạn.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMyShifts();
  }, [loadMyShifts]);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Gom nhóm các ca làm theo ngày (work_date)
  const groupedByDate = shifts.reduce((acc, shift) => {
    const d = shift.work_date.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(shift);
    return acc;
  }, {});

  const dates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ca làm việc của tôi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi lịch trực và ca làm việc được phân công trong 14 ngày tới.
          </p>
        </div>
        {range.from && range.to && (
          <div className="text-xs font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 self-start sm:self-auto">
            📅 {formatDateVN(range.from)} – {formatDateVN(range.to)}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton count={4} />
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🗓️</div>
          <h3 className="text-base font-semibold text-gray-900">Chưa có ca làm việc nào</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Bạn hiện chưa có lịch phân ca trong 14 ngày tới. Vui lòng liên hệ quản lý để được sắp xếp lịch trực.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dates.map((dateStr) => {
              const isToday = dateStr === todayStr;
              const dayShifts = groupedByDate[dateStr];
              const weekday = getWeekdayName(dateStr);

              return (
                <div
                  key={dateStr}
                  className={`rounded-xl border p-4 shadow-sm transition-all ${
                    isToday
                      ? 'bg-blue-50/40 border-blue-300 ring-2 ring-blue-500/20 shadow-blue-50'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Tiêu đề ngày */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div>
                      <span className="font-bold text-gray-900">{weekday}</span>
                      <span className="text-xs text-gray-500 ml-2 font-normal">
                        ({formatDateVN(dateStr)})
                      </span>
                    </div>
                    {isToday && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  {/* Danh sách ca trong ngày */}
                  <div className="mt-3 space-y-2.5">
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white rounded-lg p-3 border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 text-sm">
                            {s.shift_name}
                          </span>
                          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                          </span>
                        </div>
                        {s.shift_description && (
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                            {s.shift_description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyShiftsPage;

