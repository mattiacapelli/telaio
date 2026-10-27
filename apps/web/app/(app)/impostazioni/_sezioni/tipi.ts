import type { conti, ragioniSociali } from "@telaio/db";

export type RagioneSocialeRow = typeof ragioniSociali.$inferSelect;
export type ContoRow = typeof conti.$inferSelect;
