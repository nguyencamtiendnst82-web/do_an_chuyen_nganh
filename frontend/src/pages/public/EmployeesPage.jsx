import { useEffect, useState } from 'react';
import employeeApi from '../../api/employeeApi';
import { CardSkeleton } from '../../components/Skeleton';
import { errorMessage } from '../../utils/format';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await employeeApi.listEmployees();
        setEmployees(res.data.data);
      } catch (err) {
        setError(errorMessage(err, 'Không thể tải danh sách đội ngũ nhân viên.'));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner giới thiệu */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-pink-600 bg-pink-50 px-3 py-1 rounded-full">
          Đội ngũ chuyên nghiệp
        </span>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          Gặp gỡ những người bạn của thú cưng
        </h1>
        <p className="text-base text-gray-600 leading-relaxed">
          Đội ngũ kỹ thuật viên tận tâm, giàu kinh nghiệm và được đào tạo bài bản trong lĩnh vực chăm sóc,
          tắm tỉa và làm đẹp cho thú cưng của bạn.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <CardSkeleton count={4} />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm">{error}</div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
          Hiện tại chưa có thông tin nhân viên nào được hiển thị.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Ảnh đại diện */}
              <div className="h-48 bg-gradient-to-tr from-pink-50 to-purple-50 flex items-center justify-center overflow-hidden">
                {emp.avatar_url ? (
                  <img
                    src={emp.avatar_url}
                    alt={emp.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-pink-100 flex items-center justify-center text-3xl font-bold text-pink-600 shadow-inner">
                    {emp.full_name?.[0]?.toUpperCase() || 'P'}
                  </div>
                )}
              </div>

              {/* Thông tin */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{emp.full_name}</h3>
                  <div className="mt-1">
                    <span className="inline-block bg-pink-50 text-pink-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {emp.specialty || 'Chuyên viên chăm sóc'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span>⭐</span>
                    <span>{emp.experience_years ? `${emp.experience_years} năm kinh nghiệm` : 'Tận tâm'}</span>
                  </span>
                  {emp.hire_date && (
                    <span className="text-gray-400">
                      Từ {emp.hire_date.slice(0, 4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;

