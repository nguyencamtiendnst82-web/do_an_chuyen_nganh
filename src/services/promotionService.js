import { pool } from '../config/db.js';
import { pickBestPromotion, toCents } from '../utils/promotionPicker.js';
import promotionRepository from '../repositories/promotionRepository.js';
import logRepository from '../repositories/logRepository.js';
import { promotionSchema, promotionActiveSchema } from '../validations/promotionSchemas.js';
import { auditContext, httpError, parseId } from '../utils/params.js';

const assertServiceExists = async (serviceId) => {
  if (!serviceId) return;
  const [rows] = await pool.query('SELECT id FROM services WHERE id = ?', [serviceId]);
  if (!rows[0]) throw httpError(422, 'Dịch vụ áp dụng không tồn tại.');
};

export const listPromotions = async () => ({ promotions: await promotionRepository.list() });

export const createPromotion = async (actor, body, req) => {
  const parsed = promotionSchema.parse(body);
  await assertServiceExists(parsed.service_id);
  const id = await promotionRepository.create({ ...parsed, created_by: actor.id });
  const promotion = await promotionRepository.findById(id);
  await logRepository.insert({ ...auditContext(req), action: 'CREATE_PROMOTION', entity_name: 'promotions', entity_id: id, new_values: { name: parsed.name } });
  return { promotion };
};

export const updatePromotion = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID khuyến mãi');
  const old = await promotionRepository.findById(id);
  if (!old) throw httpError(404, 'Không tìm thấy chương trình khuyến mãi.');
  const parsed = promotionSchema.parse(body);
  await assertServiceExists(parsed.service_id);
  await promotionRepository.update(id, parsed);
  await logRepository.insert({ ...auditContext(req), action: 'UPDATE_PROMOTION', entity_name: 'promotions', entity_id: id, old_values: { name: old.name }, new_values: { name: parsed.name } });
  return { promotion: await promotionRepository.findById(id) };
};

export const setPromotionActive = async (actor, rawId, body, req) => {
  const id = parseId(rawId, 'ID khuyến mãi');
  const old = await promotionRepository.findById(id);
  if (!old) throw httpError(404, 'Không tìm thấy chương trình khuyến mãi.');
  const { is_active } = promotionActiveSchema.parse(body);
  await promotionRepository.setActive(id, is_active);
  await logRepository.insert({ ...auditContext(req), action: is_active ? 'ENABLE_PROMOTION' : 'DISABLE_PROMOTION', entity_name: 'promotions', entity_id: id });
  return { promotion: await promotionRepository.findById(id) };
};

export default { listPromotions, createPromotion, updatePromotion, setPromotionActive, pickBestPromotion, toCents };
