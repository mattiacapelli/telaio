// Fuori da progetto-form.tsx ("use client"): una pagina server non può usare i valori esportati da lì.
export interface ValoriProgetto {
  id?: string;
  codice?: string;
  nome: string;
  descrizione: string;
  categoria: string;
  stato: string;
  priorita: string;
  responsabileId: string;
  clienteTwentyId: string;
  preventivoId: string;
  dataInizioPrevista: string;
  dataFinePrevista: string;
}

export const VALORI_VUOTI: ValoriProgetto = {
  nome: "",
  descrizione: "",
  categoria: "altro",
  stato: "pianificato",
  priorita: "normale",
  responsabileId: "",
  clienteTwentyId: "",
  preventivoId: "",
  dataInizioPrevista: "",
  dataFinePrevista: "",
};
