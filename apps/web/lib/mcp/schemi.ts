import { z } from "zod";
import { reData } from "../date";

/** Parametri ricorrenti degli strumenti MCP. */
export const data = z.string().regex(reData, "Data nel formato AAAA-MM-GG");
export const limite = z.number().int().min(1).max(200).optional();
export const id = z.uuid();
