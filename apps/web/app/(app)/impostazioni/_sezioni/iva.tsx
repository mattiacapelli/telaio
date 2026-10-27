import { formatAliquota } from "@telaio/core";
import { AnteprimaIva } from "@/components/domain/anteprima-iva";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/ui/form-modal";
import { Tag } from "@/components/ui/tag";
import { regoleDa } from "@/lib/regole";
import { salvaRegoleFiscali } from "../actions";
import { CampiFiscali } from "./campi-fiscali";
import type { ContoRow, RagioneSocialeRow } from "./tipi";

export function SezioneIva({ elenco, conti }: { elenco: RagioneSocialeRow[]; conti: ContoRow[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {elenco.map((rs) => {
        const regole = regoleDa(rs);
        const contiRs = conti.filter((c) => c.ragioneSocialeId === rs.id || c.ragioneSocialeId === null).map((c) => ({ id: c.id, nome: c.nome }));
        return (
          <Card key={rs.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{rs.nome}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone={regole.ivaAttiva ? "blue" : "orange"}>{regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : `Senza IVA · ${regole.naturaSenzaIva}`}</Tag>
                  {regole.bolloAutomatico && <Tag>Bollo automatico</Tag>}
                  {regole.ritenutaBp ? <Tag>Ritenuta {formatAliquota(regole.ritenutaBp)}</Tag> : null}
                  {regole.splitPayment && <Tag>Split payment</Tag>}
                </div>
              </div>
              <FormModal trigger="Modifica regole" triggerVariant="ghost" triggerSize="sm" title={`Regole fiscali · ${rs.nome}`} description="L'anteprima si aggiorna mentre modifichi." action={salvaRegoleFiscali}>
                {(state) => <CampiFiscali id={rs.id} iniziale={regole} contoPredefinitoId={rs.contoPredefinitoId} conti={contiRs} state={state} />}
              </FormModal>
            </div>
            <AnteprimaIva regole={regole} />
          </Card>
        );
      })}
    </div>
  );
}
