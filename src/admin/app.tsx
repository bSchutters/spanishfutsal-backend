import { Apps } from "@strapi/icons";
import pluginId from "./extensions/lffs/pluginId";
import "./tailwind.css";

export default {
  config: {
    locales: ["fr"],
  },
  bootstrap() {},
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: Apps,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: "LFFS",
      },
      Component: async () => {
        const component = await import("./extensions/lffs/pages/App");
        return component.default; // ✅ Très important
      },
      permissions: [],
    });
  },
};
