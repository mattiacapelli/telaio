import { createDb } from "@telaio/db";
import { generaRateAbbonamenti } from "./jobs/genera-rate";
import { proponiSolleciti } from "./jobs/proponi-solleciti";

const { db, client } = createDb();
console.log(await generaRateAbbonamenti(db));
console.log(await proponiSolleciti(db));
await client.end();
