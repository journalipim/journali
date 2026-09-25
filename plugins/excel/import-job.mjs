// Excel-Import als Job. Der Kern liegt im Basis-Plugin table (import-job.mjs) — dieselbe Zuordnung wie die Ansicht;
// hier steht nur, welches Format gelesen wird. Der Tasker ruft den Dienst „import" dieses Plugins auf.
import { lauf } from '../table/import-job.mjs'
await lauf('excel')
