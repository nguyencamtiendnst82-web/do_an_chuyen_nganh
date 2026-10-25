
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Gia lap repository va database, khong truy cap MySQL that
const userRepository = {
  findAll: jest.fn(),
  countAll: jest.fn(),
  findByEmail: jest.fn(),
  findByPhone: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
};

const employeeRepository = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  updateByUserId: jest.fn(),
};

const logRepository = {
  insert: jest.fn(),
};

const pool = {
  getConnection: jest.fn(),
};

jest.unstable_mockModule('../src/config/db.js', () => ({
  pool,
}));

jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({
  default: userRepository,
}));

jest.unstable_mockModule('../src/repositories/employeeRepository.js', () => ({
  default: employeeRepository,
}));

jest.unstable_mockModule('../src/repositories/logRepository.js', () => ({
  default: logRepository,
}));

// Import sau khi da khai bao mock
const { listUsers } = await import('../src/services/userService.js');

describe('Unit test userService - listUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('L1. Lay danh sach user va phan trang thanh cong', async () => {
    userRepository.findAll.mockResolvedValue([
      {
        id: 1,
        full_name: 'Nguyen Van A',
        email: 'a@example.com',
        phone: '0912345678',
        address: null,
        avatar_url: null,
        status: 'active',
        role_name: 'customer',
        role_display_name: 'Khach hang',
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
        password_hash: 'khong_duoc_tra_ve',
      },
    ]);

    userRepository.countAll.mockResolvedValue(25);

    const result = await listUsers({
      page: '2',
      limit: '10',
      role: 'customer',
      status: 'active',
      search: 'Nguyen',
    });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      role: 'customer',
      status: 'active',
      search: 'Nguyen',
    });

    expect(userRepository.countAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      role: 'customer',
      status: 'active',
      search: 'Nguyen',
    });

    expect(result.pagination).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      total_pages: 3,
    });

    expect(result.users).toHaveLength(1);
    expect(result.users[0].full_name).toBe('Nguyen Van A');
    expect(result.users[0]).not.toHaveProperty('password_hash');
  });

  test('L2. Page va limit khong hop le thi dung gia tri mac dinh', async () => {
    userRepository.findAll.mockResolvedValue([]);
    userRepository.countAll.mockResolvedValue(0);

    const result = await listUsers({
      page: 'abc',
      limit: 'abc',
    });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      role: undefined,
      status: undefined,
      search: undefined,
    });

    expect(result.pagination).toEqual({
      total: 0,
      page: 1,
      limit: 10,
      total_pages: 0,
    });

    expect(result.users).toEqual([]);
  });

  test('L3. Page am va limit vuot 100 thi duoc gioi han', async () => {
    userRepository.findAll.mockResolvedValue([]);
    userRepository.countAll.mockResolvedValue(150);

    const result = await listUsers({
      page: '-5',
      limit: '200',
    });

    expect(userRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      role: undefined,
      status: undefined,
      search: undefined,
    });

    expect(result.pagination).toEqual({
      total: 150,
      page: 1,
      limit: 100,
      total_pages: 2,
    });
  });

  test('L4. Repository loi thi listUsers nem loi ra ngoai', async () => {
    const error = new Error('Loi truy van danh sach user');

    userRepository.findAll.mockRejectedValue(error);
    userRepository.countAll.mockResolvedValue(0);

    await expect(
      listUsers({})
    ).rejects.toThrow('Loi truy van danh sach user');
  });
});
