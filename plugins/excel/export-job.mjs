// Excel-Export als Job. Der Kern liegt im Basis-Plugin table (export-job.mjs) — dieselbe Tabelle wie die Ansicht;
// hier steht nur, welches Format herauskommt. Der Tasker ruft den Dienst „export" dieses Plugins auf.
import { lauf } from '../table/export-job.mjs'
await lauf('excel')
