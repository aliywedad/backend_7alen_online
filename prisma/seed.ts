import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const IMG = (id: string, w = 600, h = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

// ─── Image catalogue ───────────────────────────────────────────────────────
const COVERS = {
  mauritanian: IMG('1547592180-85f173990554'),
  pizza:       IMG('1574071318508-1cdbab80d002'),
  shawarma:    IMG('1529006557810-274b9b2fc783'),
  burger:      IMG('1568901346375-23c9450c58cd'),
  seafood:     IMG('1559847844-5315695dadae'),
  kabsa:       IMG('1512058564366-18510be2db19'),
  grocery:     IMG('1542838132-92c53300491e'),
  freshmarket: IMG('1488459716781-31db52582fe9'),
  pharmacy:    IMG('1576671081837-49000212a0b4'),
  pharmacy2:   IMG('1584308666744-24d5c474f2ae'),
  pets:        IMG('1548767797-d8c844163c4a'),
  beauty:      IMG('1522335789203-aabd1fc54bc9'),
};

const LOGOS = {
  mauritanian: IMG('1547592180-85f173990554', 200, 200),
  pizza:       IMG('1574071318508-1cdbab80d002', 200, 200),
  shawarma:    IMG('1529006557810-274b9b2fc783', 200, 200),
  burger:      IMG('1568901346375-23c9450c58cd', 200, 200),
  seafood:     IMG('1559847844-5315695dadae', 200, 200),
  kabsa:       IMG('1512058564366-18510be2db19', 200, 200),
  grocery:     IMG('1542838132-92c53300491e', 200, 200),
  freshmarket: IMG('1488459716781-31db52582fe9', 200, 200),
  pharmacy:    IMG('1576671081837-49000212a0b4', 200, 200),
  pharmacy2:   IMG('1584308666744-24d5c474f2ae', 200, 200),
  pets:        IMG('1548767797-d8c844163c4a', 200, 200),
  beauty:      IMG('1522335789203-aabd1fc54bc9', 200, 200),
};

const FOOD = {
  thieboudienne:   IMG('1547592180-85f173990554'),
  mechui:          IMG('1608855238292-5a2a1012e9c3'),
  tea:             IMG('1544787219-7f47ccb76574'),
  juice:           IMG('1600271886742-f049cd451bba'),
  margherita:      IMG('1574071318508-1cdbab80d002'),
  pizzaChicken:    IMG('1565299624946-b28f40a0ae38'),
  garlic_bread:    IMG('1549987011-aad7e0aef78b'),
  shawarmaWrap:    IMG('1529006557810-274b9b2fc783'),
  shawarmaPlate:   IMG('1512058564366-18510be2db19'),
  classicBurger:   IMG('1568901346375-23c9450c58cd'),
  doubleBurger:    IMG('1586190848861-99aa4a171e90'),
  chickenBurger:   IMG('1562967914-608f82629710'),
  fries:           IMG('1576107232684-1279f390859f'),
  milkshake:       IMG('1570145820259-b5f7d8d84ac4'),
  grilledFish:     IMG('1559847844-5315695dadae'),
  shrimp:          IMG('1565958011703-44f9829ba187'),
  kabsaChicken:    IMG('1512058564366-18510be2db19'),
  kabsaLamb:       IMG('1547592180-85f173990554'),
  tomatoes:        IMG('1592924357228-91a4daadcfad'),
  bananas:         IMG('1571771894821-ce9b6c11b08e'),
  eggs:            IMG('1506616498886-9cc7a7e51f1d'),
  milk:            IMG('1563636619-e9143da7973b'),
  rice:            IMG('1516684732162-798a0efebf62'),
  baguette:        IMG('1549931319-a545dcf3bc73'),
  croissant:       IMG('1555507036-ab794f4afe5e'),
  avocado:         IMG('1601039611279-4c0b4e31e76b'),
  paracetamol:     IMG('1584308666744-24d5c474f2ae'),
  vitamins:        IMG('1628771065518-0d82f1938462'),
  babyDiaper:      IMG('1519689373923-f3a4e3b5a7c5'),
  catFood:         IMG('1548767797-d8c844163c4a'),
  faceWash:        IMG('1556228720-195a672e8a03'),
  lipstick:        IMG('1522335789203-aabd1fc54bc9'),
  shampoo:         IMG('1519698718984-5f4d37c53a40'),
};

// ─── Stores definition ────────────────────────────────────────────────────
const STORES = [
  {
    phone_owner: '+22220000002', name_owner: 'Sidi Ould Brahim',
    storeType: 'FOOD', category: 'restaurants',
    name: 'Tfeila Restaurant', nameAr: 'مطعم التفيلة',
    description: 'Authentic Mauritanian cuisine prepared with traditional recipes passed down through generations.',
    address: 'Tevragh Zeina, Rue des Ambassades, Nouakchott',
    lat: 18.094, lng: -15.975, phone: '+22220000002',
    deliveryFee: 50, minOrder: 300, deliveryTime: 35, rating: 4.8,
    logo: LOGOS.mauritanian, coverImage: COVERS.mauritanian,
    tags: 'mauritanian,traditional,rice,fish',
    categories: [
      {
        name: 'Traditional Dishes', nameAr: 'أطباق تقليدية',
        image: COVERS.mauritanian,
        items: [
          { name: 'Thieboudienne', nameAr: 'تيبوديان', price: 450, description: 'Mauritania\'s iconic dish — spiced rice cooked in tomato broth with whole fish and vegetables', image: FOOD.thieboudienne },
          { name: 'Mechui', nameAr: 'مشوي', price: 1200, description: 'Slow-roasted whole lamb marinated in cumin and coriander, served with flatbread', image: FOOD.mechui },
          { name: 'Mbahal', nameAr: 'مبحل', price: 300, description: 'Sweet rice dessert cooked with dates, butter and cardamom', image: FOOD.thieboudienne },
          { name: 'Assida', nameAr: 'عصيدة', price: 200, description: 'Traditional fermented grain porridge served with honey or butter', image: FOOD.mechui },
          { name: 'Harees', nameAr: 'هريسة', price: 350, description: 'Slow-cooked wheat and lamb dish, soft and hearty', image: FOOD.kabsaLamb },
        ],
      },
      {
        name: 'Drinks & Tea', nameAr: 'مشروبات وشاي',
        image: FOOD.tea,
        items: [
          { name: 'Ataya Tea (3 rounds)', nameAr: 'أتاي (3 دورات)', price: 80, description: 'Traditional Mauritanian green tea ceremony — sweet, bitter and mild rounds', image: FOOD.tea },
          { name: 'Zrig', nameAr: 'زريق', price: 100, description: 'Chilled camel milk blended with dates — a Mauritanian delicacy', image: FOOD.juice },
          { name: 'Bissap Juice', nameAr: 'عصير البسباس', price: 80, description: 'Chilled hibiscus juice with a dash of ginger', image: FOOD.juice },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000003', name_owner: 'Ali Ould Camara',
    storeType: 'FOOD', category: 'pizza',
    name: 'Pizza Nouakchott', nameAr: 'بيتزا نواكشوط',
    description: 'Stone-oven pizzas with imported Italian ingredients — the best slice in Mauritania.',
    address: 'Ksar, Avenue Kennedy, Nouakchott',
    lat: 18.079, lng: -15.965, phone: '+22220000003',
    deliveryFee: 60, minOrder: 400, deliveryTime: 30, rating: 4.6,
    logo: LOGOS.pizza, coverImage: COVERS.pizza,
    tags: 'pizza,italian,stone-oven',
    categories: [
      {
        name: 'Signature Pizzas', nameAr: 'بيتزا مميزة',
        image: COVERS.pizza,
        items: [
          { name: 'Margherita', nameAr: 'مارغريتا', price: 350, description: 'San Marzano tomato sauce, fresh mozzarella, basil — the classic', image: FOOD.margherita },
          { name: 'Pizza Shawarma', nameAr: 'بيتزا شاورما', price: 480, description: 'Our signature — chicken shawarma, tahini drizzle and pickles on pizza dough', image: FOOD.pizzaChicken },
          { name: 'Four Cheese', nameAr: 'أربعة أجبان', price: 520, description: 'Mozzarella, cheddar, gouda and parmesan — rich and indulgent', image: FOOD.margherita },
          { name: 'BBQ Chicken', nameAr: 'دجاج باربيكيو', price: 450, description: 'Grilled chicken, caramelized onions and BBQ sauce', image: FOOD.pizzaChicken },
        ],
      },
      {
        name: 'Sides & Drinks', nameAr: 'مرافقات ومشروبات',
        image: FOOD.garlic_bread,
        items: [
          { name: 'Garlic Bread', nameAr: 'خبز بالثوم', price: 100, description: 'Toasted baguette with herb butter and garlic', image: FOOD.garlic_bread },
          { name: 'Caesar Salad', nameAr: 'سلطة سيزر', price: 180, description: 'Romaine lettuce, parmesan, croutons and Caesar dressing', image: FOOD.avocado },
          { name: 'Soft Drink 500ml', nameAr: 'مشروب غازي', price: 80, description: 'Coca-Cola, Fanta, Sprite or still water', image: FOOD.juice },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000004', name_owner: 'Mohamed El Moukhtar',
    storeType: 'FOOD', category: 'shawarma',
    name: 'Shawarma Al Madina', nameAr: 'شاورما المدينة',
    description: 'Lebanon-style shawarma grilled on vertical rotisserie, served fresh all day.',
    address: 'Dar Naim, Route de Rosso, Nouakchott',
    lat: 18.056, lng: -15.952, phone: '+22220000004',
    deliveryFee: 40, minOrder: 200, deliveryTime: 20, rating: 4.7,
    logo: LOGOS.shawarma, coverImage: COVERS.shawarma,
    tags: 'shawarma,lebanese,wrap,grill',
    categories: [
      {
        name: 'Shawarma Wraps', nameAr: 'شاورما ملفوف',
        image: COVERS.shawarma,
        items: [
          { name: 'Chicken Shawarma', nameAr: 'شاورما دجاج', price: 180, description: 'Marinated chicken, garlic sauce, pickles and parsley in flatbread', image: FOOD.shawarmaWrap },
          { name: 'Meat Shawarma', nameAr: 'شاورما لحم', price: 230, description: 'Grilled spiced beef with tomato, onions and tahini', image: FOOD.shawarmaWrap },
          { name: 'Mix Shawarma', nameAr: 'شاورما مكس', price: 260, description: 'Chicken & beef mix with all the sauces', image: FOOD.shawarmaWrap },
        ],
      },
      {
        name: 'Shawarma Plates', nameAr: 'طبق شاورما',
        image: FOOD.shawarmaPlate,
        items: [
          { name: 'Chicken Plate', nameAr: 'طبق دجاج', price: 380, description: 'Shawarma chicken over rice with grilled tomatoes and salad', image: FOOD.shawarmaPlate },
          { name: 'Mixed Grill Plate', nameAr: 'طبق مشاوي مشكلة', price: 550, description: 'Chicken, kofta and shish tawook over rice with hummus', image: FOOD.shawarmaPlate },
          { name: 'Hummus Platter', nameAr: 'حمص مع مشاوي', price: 250, description: 'Creamy hummus with olive oil, pine nuts and warm bread', image: FOOD.avocado },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000005', name_owner: 'Cheikh Ould Taly',
    storeType: 'FOOD', category: 'fast_food',
    name: 'Burger House MR', nameAr: 'بيت البرغر',
    description: 'Premium smash burgers made to order from locally-sourced beef — no shortcuts.',
    address: 'Socogim Port, Avenue des Palmerais, Nouakchott',
    lat: 18.070, lng: -15.985, phone: '+22220000005',
    deliveryFee: 50, minOrder: 250, deliveryTime: 25, rating: 4.5,
    logo: LOGOS.burger, coverImage: COVERS.burger,
    tags: 'burger,smash,fast food,grill',
    categories: [
      {
        name: 'Burgers', nameAr: 'برغر',
        image: COVERS.burger,
        items: [
          { name: 'Classic Smash', nameAr: 'سماش كلاسيك', price: 280, description: 'Single smash patty, American cheese, house sauce, pickles, lettuce', image: FOOD.classicBurger },
          { name: 'Double Smash', nameAr: 'دبل سماش', price: 380, description: 'Two smash patties stacked high with double cheese and caramelized onions', image: FOOD.doubleBurger },
          { name: 'Crispy Chicken', nameAr: 'دجاج مقرمش', price: 320, description: 'Crispy fried chicken thigh, sriracha mayo, coleslaw, pickles', image: FOOD.chickenBurger },
          { name: 'Mushroom Swiss', nameAr: 'مشروم سويسري', price: 360, description: 'Smash patty, sautéed mushrooms, Swiss cheese, garlic aioli', image: FOOD.doubleBurger },
        ],
      },
      {
        name: 'Sides & Shakes', nameAr: 'مرافقات وعصائر',
        image: FOOD.fries,
        items: [
          { name: 'Classic Fries', nameAr: 'بطاطس كلاسيك', price: 100, description: 'Hand-cut fries, double-fried for maximum crunch', image: FOOD.fries },
          { name: 'Loaded Fries', nameAr: 'بطاطس محملة', price: 180, description: 'Fries topped with cheese sauce, jalapeños and crispy beef bits', image: FOOD.fries },
          { name: 'Chocolate Shake', nameAr: 'ميلك شيك شوكولا', price: 200, description: 'Thick Belgian chocolate milkshake topped with whipped cream', image: FOOD.milkshake },
          { name: 'Vanilla Shake', nameAr: 'ميلك شيك فانيليا', price: 180, description: 'Classic vanilla milkshake made with real ice cream', image: FOOD.milkshake },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000006', name_owner: 'Oumar Ould Vall',
    storeType: 'FOOD', category: 'seafood',
    name: 'Poissonnerie Atlantique', nameAr: 'سمكري الأطلسي',
    description: 'Fresh Atlantic catch brought in daily from Mauritanian fishermen. Grilled, fried or traditional.',
    address: 'Port de Pêche, Zone Franche, Nouakchott',
    lat: 18.015, lng: -16.041, phone: '+22220000006',
    deliveryFee: 70, minOrder: 500, deliveryTime: 40, rating: 4.9,
    logo: LOGOS.seafood, coverImage: COVERS.seafood,
    tags: 'seafood,fish,grilled,fresh,atlantic',
    categories: [
      {
        name: 'Grilled Fish', nameAr: 'سمك مشوي',
        image: COVERS.seafood,
        items: [
          { name: 'Grilled Sea Bass 1kg', nameAr: 'قاروص مشوي', price: 750, description: 'Whole Atlantic sea bass grilled with lemon, herbs and olive oil', image: FOOD.grilledFish },
          { name: 'Grilled Mullet', nameAr: 'بوري مشوي', price: 600, description: 'Fresh Mauritanian grey mullet grilled over charcoal', image: FOOD.grilledFish },
          { name: 'Grilled Snapper', nameAr: 'دنيس مشوي', price: 800, description: 'Red snapper with Chermoula marinade, served with rice', image: FOOD.grilledFish },
        ],
      },
      {
        name: 'Shrimp & Fried', nameAr: 'روبيان ومقليات',
        image: FOOD.shrimp,
        items: [
          { name: 'Fried Shrimp Basket', nameAr: 'روبيان مقلي', price: 600, description: 'Crispy deep-fried Atlantic shrimp with tartar sauce and fries', image: FOOD.shrimp },
          { name: 'Calamari Rings', nameAr: 'حلقات كلاماري', price: 450, description: 'Lightly battered calamari rings with garlic dipping sauce', image: FOOD.shrimp },
          { name: 'Fish & Chips', nameAr: 'سمك وبطاطس', price: 500, description: 'Beer-battered white fish with thick-cut fries and coleslaw', image: FOOD.grilledFish },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000007', name_owner: 'Abderrahmane Ould Sid',
    storeType: 'FOOD', category: 'restaurants',
    name: 'Kabsa Palace', nameAr: 'قصر الكبسة',
    description: 'Authentic Saudi-style kabsa with slow-cooked meats and fragrant saffron rice.',
    address: 'Tevragh Zeina, Rue Mamadou Konaté, Nouakchott',
    lat: 18.098, lng: -15.978, phone: '+22220000007',
    deliveryFee: 55, minOrder: 400, deliveryTime: 35, rating: 4.7,
    logo: LOGOS.kabsa, coverImage: COVERS.kabsa,
    tags: 'arabic,kabsa,rice,saudi,lamb',
    categories: [
      {
        name: 'Kabsa', nameAr: 'كبسة',
        image: COVERS.kabsa,
        items: [
          { name: 'Chicken Kabsa (half)', nameAr: 'كبسة دجاج نصف', price: 450, description: 'Fragrant saffron rice with half chicken, roasted nuts and raisins', image: FOOD.kabsaChicken },
          { name: 'Lamb Kabsa (1 person)', nameAr: 'كبسة لحم فردي', price: 650, description: 'Slow-cooked lamb shoulder on spiced long-grain rice', image: FOOD.kabsaLamb },
          { name: 'Mixed Kabsa Family (4)', nameAr: 'كبسة مشكل عائلي', price: 2000, description: 'Whole chicken + lamb on a large tray, serves 4 people', image: FOOD.kabsaLamb },
          { name: 'Mandi Chicken', nameAr: 'مندي دجاج', price: 500, description: 'Slow-cooked chicken in clay pit over smoked wood chips', image: FOOD.kabsaChicken },
        ],
      },
      {
        name: 'Sides & Desserts', nameAr: 'مقبلات وحلويات',
        image: FOOD.juice,
        items: [
          { name: 'Arabic Salad', nameAr: 'سلطة عربية', price: 150, description: 'Tomato, cucumber, parsley with lemon dressing', image: FOOD.avocado },
          { name: 'Laban Ayran', nameAr: 'لبن عيران', price: 100, description: 'Chilled salted yogurt drink', image: FOOD.milk },
          { name: 'Umm Ali', nameAr: 'أم علي', price: 200, description: 'Egyptian bread pudding with cream, nuts and raisins', image: FOOD.thieboudienne },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000008', name_owner: 'Isselmou Ould Ahmed',
    storeType: 'GROCERY', category: 'grocery',
    name: 'Chinguetti Supermarket', nameAr: 'سوبرماركت شنقيطي',
    description: 'Your one-stop grocery store for local and imported products. Fresh produce daily.',
    address: 'Centre Ville, Avenue de la Liberté, Nouakchott',
    lat: 18.087, lng: -15.971, phone: '+22220000008',
    deliveryFee: 60, minOrder: 500, deliveryTime: 45, rating: 4.4,
    logo: LOGOS.grocery, coverImage: COVERS.grocery,
    tags: 'grocery,supermarket,fresh,imported',
    categories: [
      {
        name: 'Fruits & Vegetables', nameAr: 'فواكه وخضروات',
        image: FOOD.tomatoes,
        items: [
          { name: 'Tomatoes 1kg', nameAr: 'طماطم ١ كيلو', price: 80, description: 'Fresh vine-ripened local tomatoes', image: FOOD.tomatoes },
          { name: 'Bananas bunch (~6)', nameAr: 'موز عنقود', price: 120, description: 'Sweet ripe Canary Island bananas', image: FOOD.bananas },
          { name: 'Dates 500g Deglet', nameAr: 'تمر دقلة نور', price: 220, description: 'Premium soft Algerian Deglet Noor dates', image: FOOD.thieboudienne },
          { name: 'Avocado 2pcs', nameAr: 'أفوكادو قطعتان', price: 200, description: 'Ripe Hass avocados ready to eat', image: FOOD.avocado },
          { name: 'Potatoes 2kg', nameAr: 'بطاطس ٢ كيلو', price: 150, description: 'Fresh Dutch yellow potatoes', image: FOOD.fries },
        ],
      },
      {
        name: 'Dairy & Eggs', nameAr: 'ألبان وبيض',
        image: FOOD.eggs,
        items: [
          { name: 'Fresh Milk 1L', nameAr: 'حليب طازج ١ لتر', price: 120, description: 'Pasteurised full-fat fresh milk', image: FOOD.milk },
          { name: 'Eggs x12', nameAr: '١٢ بيضة', price: 180, description: 'Free-range farm eggs, large size', image: FOOD.eggs },
          { name: 'Natural Yogurt 500g', nameAr: 'زبادي طبيعي', price: 150, description: 'Thick Greek-style plain yogurt', image: FOOD.milk },
          { name: 'Butter 250g', nameAr: 'زبدة', price: 200, description: 'Unsalted French butter', image: FOOD.croissant },
        ],
      },
      {
        name: 'Pantry Essentials', nameAr: 'مؤن أساسية',
        image: FOOD.rice,
        items: [
          { name: 'Jasmine Rice 5kg', nameAr: 'أرز ياسمين ٥ كيلو', price: 450, description: 'Fragrant Thai jasmine long-grain rice', image: FOOD.rice },
          { name: 'Spaghetti 500g', nameAr: 'سباغيتي', price: 120, description: 'Italian durum wheat spaghetti n°5', image: FOOD.rice },
          { name: 'Cooking Oil 2L', nameAr: 'زيت طهي ٢ لتر', price: 380, description: 'Pure sunflower cooking oil', image: FOOD.juice },
          { name: 'White Sugar 2kg', nameAr: 'سكر أبيض ٢ كيلو', price: 200, description: 'Refined white cane sugar', image: FOOD.milk },
          { name: 'Tomato Paste 400g', nameAr: 'معجون طماطم', price: 120, description: 'Concentrated Italian tomato paste', image: FOOD.tomatoes },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000009', name_owner: 'Mariem Mint Vall',
    storeType: 'GROCERY', category: 'grocery',
    name: 'Fresh Market Tevragh', nameAr: 'السوق الطازج تفرغ',
    description: 'Premium organic and fresh produce — bakery, cheeses, charcuterie and seasonal vegetables.',
    address: 'Tevragh Zeina, Rue des Banques, Nouakchott',
    lat: 18.096, lng: -15.981, phone: '+22220000009',
    deliveryFee: 50, minOrder: 300, deliveryTime: 30, rating: 4.6,
    logo: LOGOS.freshmarket, coverImage: COVERS.freshmarket,
    tags: 'grocery,organic,bakery,fresh,healthy',
    categories: [
      {
        name: 'Bakery', nameAr: 'مخبز',
        image: FOOD.baguette,
        items: [
          { name: 'Baguette', nameAr: 'خبز فرنسي', price: 40, description: 'Freshly baked crispy baguette, done daily from 6am', image: FOOD.baguette },
          { name: 'Croissant x2', nameAr: 'كرواسون', price: 140, description: 'Buttery all-butter croissants, baked fresh every morning', image: FOOD.croissant },
          { name: 'Pain au Chocolat x2', nameAr: 'خبز بالشوكولا', price: 160, description: 'Flaky pastry with dark chocolate inside', image: FOOD.croissant },
        ],
      },
      {
        name: 'Fresh Produce', nameAr: 'منتجات طازجة',
        image: FOOD.avocado,
        items: [
          { name: 'Avocado 2pcs', nameAr: 'أفوكادو', price: 220, description: 'Ready-to-eat Hass avocados from Morocco', image: FOOD.avocado },
          { name: 'Mixed Herbs Bundle', nameAr: 'أعشاب طازجة', price: 80, description: 'Fresh coriander, parsley, mint and thyme', image: FOOD.avocado },
          { name: 'Baby Spinach 150g', nameAr: 'سبانخ صغيرة', price: 150, description: 'Tender organic baby spinach leaves', image: FOOD.avocado },
          { name: 'Strawberries 400g', nameAr: 'فراولة', price: 280, description: 'Sweet seasonal strawberries', image: FOOD.bananas },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000010', name_owner: 'Khadijatou Mint Ely',
    storeType: 'PHARMACY', category: 'pharmacy',
    name: 'Pharmacie Al Amal', nameAr: 'صيدلية الأمل',
    description: 'Your trusted 24/7 pharmacy — certified pharmacists, full stock, fast delivery.',
    address: 'Tevragh Zeina, Rue du Roi Faisal, Nouakchott',
    lat: 18.091, lng: -15.973, phone: '+22220000010',
    deliveryFee: 40, minOrder: 100, deliveryTime: 25, rating: 4.8,
    logo: LOGOS.pharmacy, coverImage: COVERS.pharmacy,
    tags: 'pharmacy,medicine,health,24h,parapharmacie',
    categories: [
      {
        name: 'Pain & Fever', nameAr: 'مسكنات وحمى',
        image: FOOD.paracetamol,
        items: [
          { name: 'Paracetamol 500mg x20', nameAr: 'باراسيتامول', price: 60, description: 'Pain and fever relief tablets — suitable for adults and children', image: FOOD.paracetamol },
          { name: 'Ibuprofen 400mg x20', nameAr: 'إيبوبروفين', price: 90, description: 'Anti-inflammatory pain reliever and fever reducer', image: FOOD.paracetamol },
          { name: 'Cough Syrup 150ml', nameAr: 'شراب سعال', price: 200, description: 'Dry and productive cough — honey and eucalyptus base', image: FOOD.vitamins },
        ],
      },
      {
        name: 'Vitamins & Immunity', nameAr: 'فيتامينات ومناعة',
        image: FOOD.vitamins,
        items: [
          { name: 'Vitamin C 1000mg x30', nameAr: 'فيتامين سي', price: 140, description: 'High-dose Vitamin C effervescent tablets for immune support', image: FOOD.vitamins },
          { name: 'Multivitamin x30', nameAr: 'متعدد الفيتامينات', price: 300, description: 'Daily complete vitamin and mineral complex for adults', image: FOOD.vitamins },
          { name: 'Omega-3 Fish Oil x30', nameAr: 'أوميغا ٣', price: 380, description: 'High-potency EPA & DHA fish oil softgels', image: FOOD.vitamins },
          { name: 'Zinc + Vitamin D3 x30', nameAr: 'زنك وفيتامين د', price: 250, description: 'Immunity-boosting zinc and vitamin D3 combo', image: FOOD.vitamins },
        ],
      },
      {
        name: 'Baby & Mother', nameAr: 'أطفال وأمومة',
        image: FOOD.babyDiaper,
        items: [
          { name: 'Baby Diapers Size 3 x24', nameAr: 'حفاضات مقاس ٣', price: 450, description: 'Soft ultra-dry diapers for babies 6–10kg', image: FOOD.babyDiaper },
          { name: 'Infant Formula Stage 1 400g', nameAr: 'حليب رضع مرحلة ١', price: 700, description: 'Complete nutrition for newborns 0–6 months', image: FOOD.milk },
          { name: 'Baby Wipes x80', nameAr: 'مناديل أطفال', price: 130, description: 'Fragrance-free sensitive skin baby wipes', image: FOOD.babyDiaper },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000011', name_owner: 'Brahim Ould Diallo',
    storeType: 'PHARMACY', category: 'pharmacy',
    name: 'Pharmacie Ibn Sina', nameAr: 'صيدلية ابن سينا',
    description: 'Expert pharmaceutical care — dermatology, diabetics, chronic condition specialists.',
    address: 'Ksar, Rue Abdallaye Ould, Nouakchott',
    lat: 18.075, lng: -15.961, phone: '+22220000011',
    deliveryFee: 40, minOrder: 100, deliveryTime: 30, rating: 4.7,
    logo: LOGOS.pharmacy2, coverImage: COVERS.pharmacy2,
    tags: 'pharmacy,medicine,dermatology,chronic',
    categories: [
      {
        name: 'First Aid', nameAr: 'إسعافات أولية',
        image: FOOD.paracetamol,
        items: [
          { name: 'Complete First Aid Kit', nameAr: 'حقيبة إسعاف متكاملة', price: 600, description: 'Bandages, antiseptic, scissors, gloves and more — WHO compliant', image: FOOD.paracetamol },
          { name: 'Sterile Bandages x10', nameAr: 'ضمادات معقمة', price: 90, description: 'Various sizes — individually wrapped sterile wound dressings', image: FOOD.paracetamol },
          { name: 'Betadine Antiseptic 125ml', nameAr: 'بيتادين مطهر', price: 130, description: 'Broad-spectrum antiseptic for wound cleaning', image: FOOD.paracetamol },
          { name: 'Digital Thermometer', nameAr: 'ميزان حرارة رقمي', price: 280, description: 'Fast-read oral/axillary thermometer with fever alarm', image: FOOD.vitamins },
        ],
      },
    ],
  },
  {
    phone_owner: '+22220000012', name_owner: 'Fatimetou Mint Ahmed',
    storeType: 'BEAUTY', category: 'beauty',
    name: 'Beauté Mauritanie', nameAr: 'جمال موريتانيا',
    description: 'Premium international beauty and skincare brands — delivered to your door.',
    address: 'Centre Commercial Carrefour, Nouakchott',
    lat: 18.084, lng: -15.968, phone: '+22220000012',
    deliveryFee: 45, minOrder: 300, deliveryTime: 35, rating: 4.6,
    logo: LOGOS.beauty, coverImage: COVERS.beauty,
    tags: 'beauty,cosmetics,skincare,makeup,hair',
    categories: [
      {
        name: 'Skincare', nameAr: 'العناية بالبشرة',
        image: FOOD.faceWash,
        items: [
          { name: 'Gentle Face Wash 150ml', nameAr: 'غسول وجه لطيف', price: 280, description: 'Soap-free foaming face wash for all skin types — removes impurities gently', image: FOOD.faceWash },
          { name: 'Vitamin C Brightening Serum 30ml', nameAr: 'سيروم فيتامين سي', price: 650, description: '15% stable Vitamin C serum — fades dark spots and brightens complexion', image: FOOD.faceWash },
          { name: 'SPF 50+ Sunscreen 50ml', nameAr: 'واقي شمس SPF50', price: 350, description: 'Lightweight broad-spectrum UVA/UVB sunscreen, non-greasy finish', image: FOOD.faceWash },
          { name: 'Hydrating Face Moisturizer 50ml', nameAr: 'مرطب وجه', price: 400, description: 'Hyaluronic acid and aloe vera moisturizer for dry and normal skin', image: FOOD.faceWash },
        ],
      },
      {
        name: 'Makeup', nameAr: 'مكياج',
        image: FOOD.lipstick,
        items: [
          { name: 'Full Coverage Foundation', nameAr: 'كريم أساس', price: 380, description: 'Long-lasting buildable coverage in 20 shades including Mauritanian skin tones', image: FOOD.lipstick },
          { name: 'Volumizing Mascara', nameAr: 'ماسكارا مضخمة', price: 220, description: 'Dramatic lash volume and curl — waterproof formula', image: FOOD.lipstick },
          { name: 'Lipstick Set x3', nameAr: 'مجموعة أحمر شفاه', price: 320, description: 'Three curated shades: nude blush, berry and classic red', image: FOOD.lipstick },
        ],
      },
      {
        name: 'Hair Care', nameAr: 'العناية بالشعر',
        image: FOOD.shampoo,
        items: [
          { name: 'Argan Oil Shampoo 300ml', nameAr: 'شامبو بزيت أركان', price: 320, description: 'Sulfate-free shampoo with pure Moroccan argan oil — repairs and moisturises', image: FOOD.shampoo },
          { name: 'Deep Repair Hair Mask 300ml', nameAr: 'قناع شعر مكثف', price: 380, description: '3-minute deep conditioning treatment for damaged and frizzy hair', image: FOOD.shampoo },
          { name: 'Castor Oil 100ml', nameAr: 'زيت الخروع', price: 180, description: 'Pure cold-pressed castor oil for hair growth and scalp health', image: FOOD.shampoo },
        ],
      },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding 7alan database…');
  const hash = await bcrypt.hash('password123', 10);

  // ── Admins (3) ───────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { phone: '+22200000000' },
    update: { name: 'Admin 7alan', role: 'ADMIN', password: hash },
    create: { phone: '+22200000000', name: 'Admin 7alan', role: 'ADMIN', password: hash },
  });
  await prisma.user.upsert({
    where: { phone: '+22200000001' },
    update: { name: 'Fatima Mint Salma', role: 'ADMIN', password: hash },
    create: { phone: '+22200000001', name: 'Fatima Mint Salma', role: 'ADMIN', password: hash },
  });
  await prisma.user.upsert({
    where: { phone: '+22200000002' },
    update: { name: 'Omar Ould Sidi', role: 'ADMIN', password: hash },
    create: { phone: '+22200000002', name: 'Omar Ould Sidi', role: 'ADMIN', password: hash },
  });

  // ── Customers (3) ────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { phone: '+22220000001' },
    update: { name: 'Ahmed Ould Mohamed', role: 'CUSTOMER', password: hash },
    create: { phone: '+22220000001', name: 'Ahmed Ould Mohamed', role: 'CUSTOMER', password: hash },
  });
  await prisma.user.upsert({
    where: { phone: '+22220000099' },
    update: { name: 'Mariem Mint Vall', role: 'CUSTOMER', password: hash },
    create: { phone: '+22220000099', name: 'Mariem Mint Vall', role: 'CUSTOMER', password: hash },
  });
  await prisma.user.upsert({
    where: { phone: '+22220000098' },
    update: { name: 'Khalil Ould Abdi', role: 'CUSTOMER', password: hash },
    create: { phone: '+22220000098', name: 'Khalil Ould Abdi', role: 'CUSTOMER', password: hash },
  });

  // ── Drivers (3) ──────────────────────────────────────────────────────────
  const driver1 = await prisma.user.upsert({
    where: { phone: '+22220000014' },
    update: { name: 'Moussa Ould Haiba', role: 'DRIVER', password: hash },
    create: { phone: '+22220000014', name: 'Moussa Ould Haiba', role: 'DRIVER', password: hash },
  });
  await prisma.driverProfile.upsert({
    where: { userId: driver1.id },
    update: {},
    create: {
      userId: driver1.id,
      vehicleType: 'MOTO',
      vehiclePlate: 'NKT 4521 MR',
      isOnline: true,
      currentLat: 18.0735,
      currentLng: -15.9582,
      rating: 4.9,
      totalDeliveries: 142,
      earnings: 28400,
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { phone: '+22220000015' },
    update: { name: 'Ibrahim Ould Daf', role: 'DRIVER', password: hash },
    create: { phone: '+22220000015', name: 'Ibrahim Ould Daf', role: 'DRIVER', password: hash },
  });
  await prisma.driverProfile.upsert({
    where: { userId: driver2.id },
    update: {},
    create: {
      userId: driver2.id,
      vehicleType: 'CAR',
      vehiclePlate: 'NKT 7834 MR',
      isOnline: false,
      currentLat: 18.094,
      currentLng: -15.975,
      rating: 4.6,
      totalDeliveries: 87,
      earnings: 17400,
    },
  });

  const driver3 = await prisma.user.upsert({
    where: { phone: '+22220000016' },
    update: { name: 'Aisha Mint Brahim', role: 'DRIVER', password: hash },
    create: { phone: '+22220000016', name: 'Aisha Mint Brahim', role: 'DRIVER', password: hash },
  });
  await prisma.driverProfile.upsert({
    where: { userId: driver3.id },
    update: {},
    create: {
      userId: driver3.id,
      vehicleType: 'MOTO',
      vehiclePlate: 'NKT 2291 MR',
      isOnline: true,
      currentLat: 18.079,
      currentLng: -15.965,
      rating: 4.8,
      totalDeliveries: 215,
      earnings: 43000,
    },
  });

  // ── Stores ────────────────────────────────────────────────────────────────
  for (const store of STORES) {
    const { phone_owner, name_owner, categories, ...fields } = store;

    const owner = await prisma.user.upsert({
      where: { phone: phone_owner },
      update: {},
      create: { phone: phone_owner, name: name_owner, role: 'RESTAURANT_OWNER', password: hash },
    });

    let restaurant = await prisma.restaurant.findUnique({ where: { ownerId: owner.id } });
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          ownerId: owner.id,
          name: fields.name,
          nameAr: fields.nameAr,
          description: fields.description,
          storeType: fields.storeType,
          category: fields.category,
          logo: fields.logo,
          coverImage: fields.coverImage,
          address: fields.address,
          lat: fields.lat,
          lng: fields.lng,
          phone: fields.phone,
          deliveryFee: fields.deliveryFee,
          minOrder: fields.minOrder,
          deliveryTime: fields.deliveryTime,
          rating: fields.rating,
          tags: fields.tags,
          isOpen: true,
          isActive: true,
        },
      });
      console.log(`  ✓ Created: ${restaurant.name}`);
    } else {
      console.log(`  · Exists:  ${restaurant.name}`);
    }

    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      let category = await prisma.menuCategory.findFirst({
        where: { restaurantId: restaurant.id, name: cat.name },
      });
      if (!category) {
        category = await prisma.menuCategory.create({
          data: {
            restaurantId: restaurant.id,
            name: cat.name,
            nameAr: cat.nameAr,
            image: cat.image,
            sortOrder: ci,
          },
        });
      }

      for (const item of cat.items) {
        const existing = await prisma.menuItem.findFirst({
          where: { categoryId: category.id, name: item.name },
        });
        if (!existing) {
          await prisma.menuItem.create({
            data: {
              categoryId: category.id,
              name: item.name,
              nameAr: item.nameAr,
              description: item.description,
              price: item.price,
              image: item.image,
              isAvailable: true,
            },
          });
        }
      }
    }
  }

  // ── Coupons ───────────────────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      description: '10% off your first order — max 150 MRU discount',
      type: 'PERCENTAGE',
      value: 10,
      minOrder: 200,
      maxDiscount: 150,
      perUserLimit: 1,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'FREESHIP' },
    update: {},
    create: {
      code: 'FREESHIP',
      description: 'Free delivery on orders 300 MRU and above',
      type: 'FREE_DELIVERY',
      value: 0,
      minOrder: 300,
      perUserLimit: 5,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'PHARMA50' },
    update: {},
    create: {
      code: 'PHARMA50',
      description: '50 MRU off any pharmacy order',
      type: 'FIXED',
      value: 50,
      minOrder: 200,
      perUserLimit: 3,
      scope: 'STORE_TYPE',
      storeType: 'PHARMACY',
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'BURGER20' },
    update: {},
    create: {
      code: 'BURGER20',
      description: '20% off at Burger House MR this weekend',
      type: 'PERCENTAGE',
      value: 20,
      minOrder: 300,
      maxDiscount: 200,
      perUserLimit: 2,
      isActive: true,
    },
  });

  // ── Banners ───────────────────────────────────────────────────────────────
  const banners = [
    {
      id: 'banner-welcome',
      title: 'Welcome to 7alan 🎉',
      subtitle: 'Get 10% off your first order with code WELCOME10',
      backgroundColor: '#00C47A',
      ctaText: 'Order now',
      sortOrder: 0,
      isActive: true,
    },
    {
      id: 'banner-pharmacy',
      title: 'Health at your door 💊',
      subtitle: '50 MRU off pharmacy orders — use PHARMA50',
      backgroundColor: '#0D1B2A',
      storeType: 'PHARMACY',
      ctaText: 'Shop pharmacy',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'banner-freeship',
      title: 'Free delivery today 🛵',
      subtitle: 'No delivery fee on orders 300 MRU+ — code FREESHIP',
      backgroundColor: '#E8441A',
      ctaText: 'Get it free',
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'banner-grocery',
      title: 'Fresh groceries 🥦',
      subtitle: 'Farm-to-door in under 45 minutes',
      backgroundColor: '#2E7D32',
      storeType: 'GROCERY',
      ctaText: 'Shop grocery',
      sortOrder: 3,
      isActive: true,
    },
  ];

  for (const b of banners) {
    await prisma.banner.upsert({ where: { id: b.id }, update: b, create: b });
  }

  // ── Platform Settings ─────────────────────────────────────────────────────
  const settings = [
    { key: 'platform_name',           value: '7alan',               category: 'GENERAL' },
    { key: 'support_phone',           value: '+22220000000',        category: 'GENERAL' },
    { key: 'default_currency',        value: 'MRU',                 category: 'GENERAL' },
    { key: 'default_country_code',    value: '+222',                category: 'GENERAL' },
    { key: 'courier_base_fee',        value: '60',                  category: 'COURIER' },
    { key: 'courier_fee_per_km',      value: '18',                  category: 'COURIER' },
    { key: 'platform_commission_pct', value: '15',                  category: 'FINANCE' },
    { key: 'loyalty_points_per_mru',  value: '1',                   category: 'LOYALTY' },
    { key: 'referral_bonus_mru',      value: '100',                 category: 'LOYALTY' },
    { key: 'default_delivery_lat',    value: '18.0735',             category: 'GEO'     },
    { key: 'default_delivery_lng',    value: '-15.9582',            category: 'GEO'     },
  ];
  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  console.log('\n✅ Seed complete:');
  console.log(`   ${STORES.length} restaurants • 4 coupons • 4 banners • ${settings.length} settings`);
  console.log('   Admins:    +22200000000 / +22200000001 / +22200000002');
  console.log('   Customers: +22220000001 / +22220000099 / +22220000098');
  console.log('   Drivers:   +22220000014 / +22220000015 / +22220000016');
  console.log('   Owners:    +22220000002 / +22220000003 / +22220000004  (+ 8 more)');
  console.log('   All passwords: password123');
}

main().catch((e) => { console.error(e);   }).finally(() => prisma.$disconnect());
