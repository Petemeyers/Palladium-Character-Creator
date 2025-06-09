// shop.js

import items from './items';

const ShopFactory = {
  createShop(name, category) {
    return {
      name,
      category,
      async getItems() {
        try {
          return items[category] || [];
        } catch (error) {
          console.error(`Error fetching items for ${name}:`, error);
          throw error;
        }
      }
    };
  }
};

export const shops = {
  weapons: ShopFactory.createShop('Weapons Shop', 'Weapons'),
  clothing: ShopFactory.createShop('Clothing Shop', 'Clothing'),
  lighting: ShopFactory.createShop('Lighting Shop', 'Lighting'),
  containers: ShopFactory.createShop('Container Shop', 'Containers')
};
