import { SPECIES_ICON } from '../utils/format'

/** Ảnh thú cưng; chưa có ảnh thì hiện biểu tượng theo loài */
const PetAvatar = ({ pet, size = 'w-14 h-14', text = 'text-2xl' }) =>
  pet.avatar_url ? (
    <img src={pet.avatar_url} alt={`Ảnh của ${pet.name}`} loading="lazy"
      className={`${size} rounded-full object-cover bg-pink-50 shrink-0`} />
  ) : (
    <div className={`${size} ${text} rounded-full bg-pink-50 flex items-center justify-center shrink-0`} aria-hidden="true">
      {SPECIES_ICON[pet.species] || '🐾'}
    </div>
  )

export default PetAvatar
