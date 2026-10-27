import { createDb } from "@telaio/db";
import { generaRateAbbonamenti } from "./jobs/genera-rate";

const { db, client } = createDb();
console.log(await generaRateAbbonamenti(db));
await client.end();
