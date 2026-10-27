import type { RegoleFiscali } from "@telaio/core";
import type { ragioniSociali } from "@telaio/db";

type RagioneSociale = typeof ragioniSociali.$inferSelect;

export function regoleDa(rs: RagioneSociale): RegoleFiscali {
  return {
    ivaAttiva: rs.ivaAttiva,
    aliquotaIvaBp: rs.aliquotaIvaBp,
    naturaSenzaIva: rs.naturaSenzaIva,
    diciturSenzaIva: rs.diciturSenzaIva,
    bolloAutomatico: rs.bolloAutomatico,
    ritenutaBp: rs.ritenutaBp,
    splitPayment: rs.splitPayment,
  };
}
