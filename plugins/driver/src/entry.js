// Plugin driver: ⌁ Werkzeuge → Zugänge. Eine Ansicht, die die Zugänge des Servers verwaltet (/api/drivers);
// die Arten und ihre Felder kennt der Server (DriverApi.cs), hier steht nur die Bedienung.
import View from './View.vue'
import { t } from 'journali'
export default {
  views: [{ path: 'zugaenge', topic: 'tools', label: t('Zugänge'), icon: '⌁', hint: t('Dateisystem, FTP, WebDAV, Anmeldungen an MySQL, Solr, IXP — einmal einrichten, von jedem Plugin nutzbar'), component: View }],
}
