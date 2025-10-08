/**
 * joueur router
 */

import { factories } from '@strapi/strapi';

const defaultRouter = factories.createCoreRouter('api::joueur.joueur');

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;
  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      if (!routes) routes = innerRouter.routes.concat(extraRoutes);
      return routes;
    },
  };
};

const myExtraRoutes = [
  {
    method: 'GET',
    path: '/joueurs-with-stats',
    handler: 'joueur.findWithStats',
    config: {
      auth: false,
    },
  },
  {
    method: 'GET',
    path: '/joueurs/:id/match-stats',
    handler: 'joueur.getMatchStats',
    config: {
      auth: false,
    },
  },
];

export default customRouter(defaultRouter, myExtraRoutes);
