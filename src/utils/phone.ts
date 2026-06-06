export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    return digits;
  }

  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }

  return `+${digits}`;
}

export function toWhatsAppAddress(phone: string): string {
  const formatted = formatPhoneNumber(phone);
  return formatted.startsWith('whatsapp:') ? formatted : `whatsapp:${formatted}`;
}
