import { describe, test, expect } from '@jest/globals';
import { pickBestPromotion } from '../src/utils/promotionPicker.js';

const services = [
  { service_id: 1, price_at_booking: '350000.00' },
  { service_id: 2, price_at_booking: '480000.00' },
];
const promo = (o) => ({ id: 1, name: 'KM', discount_type: 'percent', discount_value: '10.00', service_id: null, min_invoice: '0.00', ...o });

describe('pickBestPromotion', () => {
  test('không có khuyến mãi -> null', () => {
    expect(pickBestPromotion([], services, 83000000n)).toBeNull();
  });

  test('giảm % áp dụng trên mọi dịch vụ', () => {
    const r = pickBestPromotion([promo({})], services, 83000000n);
    expect(r.discountCents).toBe(8300000n); // 10% của 830.000 đ = 83.000 đ
  });

  test('chương trình gắn dịch vụ chỉ tính trên dịch vụ đó; số tiền cố định không vượt giá dịch vụ', () => {
    const r = pickBestPromotion([promo({ discount_type: 'amount', discount_value: '999999.00', service_id: 2 })], services, 83000000n);
    expect(r.discountCents).toBe(48000000n);
    expect(pickBestPromotion([promo({ service_id: 99 })], services, 83000000n)).toBeNull();
  });

  test('chưa đủ hóa đơn tối thiểu thì bỏ qua; nhiều chương trình chọn mức giảm nhiều nhất, không cộng dồn', () => {
    const list = [
      promo({ id: 1, discount_type: 'amount', discount_value: '50000.00' }),
      promo({ id: 2, discount_value: '20.00', min_invoice: '2000000.00' }),
      promo({ id: 3, discount_value: '10.00' }),
    ];
    const r = pickBestPromotion(list, services, 83000000n);
    expect(r.promotion.id).toBe(3);
    expect(r.discountCents).toBe(8300000n);
  });
});
