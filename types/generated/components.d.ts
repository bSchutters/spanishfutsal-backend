import type { Schema, Struct } from '@strapi/strapi';

export interface MatchPlayerFieldStat extends Struct.ComponentSchema {
  collectionName: 'components_match_player_field_stats';
  info: {
    description: "Statistiques d'un joueur de champ pour un match sp\u00E9cifique";
    displayName: 'Stats Joueurs';
  };
  attributes: {
    assists: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    goals: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    joueur: Schema.Attribute.Relation<'oneToOne', 'api::joueur.joueur'>;
    red_cards: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    yellow_cards: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface MatchPlayerGoalkeeperStat extends Struct.ComponentSchema {
  collectionName: 'components_match_player_goalkeeper_stats';
  info: {
    description: "Statistiques d'un gardien pour un match sp\u00E9cifique";
    displayName: 'Stats Gardien';
  };
  attributes: {
    assists: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    clean_sheet: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    goals: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    joueur: Schema.Attribute.Relation<'oneToOne', 'api::joueur.joueur'>;
    red_cards: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    yellow_cards: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'match.player-field-stat': MatchPlayerFieldStat;
      'match.player-goalkeeper-stat': MatchPlayerGoalkeeperStat;
    }
  }
}
