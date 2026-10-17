export type Diet = 'veg' | 'nonveg' | 'egg' | 'jain';
export interface SeedItem {
  en: string; hi: string; descEn: string; descHi: string;
  rupees: number; diet: Diet; spice?: 0 | 1 | 2 | 3; best?: boolean; chef?: boolean; soldOut?: boolean;
}
export interface SeedCategory { en: string; hi: string; items: SeedItem[] }
export interface SeedRestaurant {
  slug: string; name: string; accent: string; reviewUrl: string; tables: number; categories: SeedCategory[];
}

const v = (en: string, hi: string, descEn: string, descHi: string, rupees: number, extra: Partial<SeedItem> = {}): SeedItem =>
  ({ en, hi, descEn, descHi, rupees, diet: 'veg', ...extra });
const n = (en: string, hi: string, descEn: string, descHi: string, rupees: number, extra: Partial<SeedItem> = {}): SeedItem =>
  ({ en, hi, descEn, descHi, rupees, diet: 'nonveg', ...extra });

export const SPICE_GARDEN: SeedRestaurant = {
  slug: 'spice-garden',
  name: 'Spice Garden',
  accent: 'tomato',
  reviewUrl: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID_SPICE_GARDEN',
  tables: 12,
  categories: [
    { en: 'Starters', hi: 'स्टार्टर्स', items: [
      v('Paneer Tikka', 'पनीर टिक्का', 'Cottage cheese marinated in spiced yoghurt, charred in the tandoor.', 'मसालेदार दही में मैरिनेट किया पनीर, तंदूर में सेंका हुआ।', 280, { spice: 2, best: true }),
      v('Hara Bhara Kebab', 'हरा भरा कबाब', 'Spinach, peas and potato patties, lightly pan-fried.', 'पालक, मटर और आलू की टिक्की, हल्की तली हुई।', 240, { spice: 1 }),
      v('Veg Manchurian (Dry)', 'वेज मंचूरियन (ड्राई)', 'Crisp vegetable dumplings tossed in a spicy garlic sauce.', 'तीखे लहसुन सॉस में लिपटे कुरकुरे वेज बॉल्स।', 220, { spice: 2 }),
      n('Chicken Tikka', 'चिकन टिक्का', 'Boneless chicken marinated overnight and grilled over charcoal.', 'रात भर मैरिनेट किया बोनलेस चिकन, कोयले पर सेंका हुआ।', 320, { spice: 2, best: true }),
      n('Tandoori Chicken (Half)', 'तंदूरी चिकन (हाफ)', 'Classic bone-in chicken, smoky and juicy.', 'क्लासिक तंदूरी चिकन, धुएँदार और रसीला।', 360, { spice: 3 }),
      n('Fish Amritsari', 'फिश अमृतसरी', 'Crisp gram-flour battered fish with ajwain and lemon.', 'अजवाइन और नींबू के साथ बेसन में तली कुरकुरी मछली।', 340, { spice: 2, chef: true }),
    ] },
    { en: 'Main Course (Veg)', hi: 'मेन कोर्स (शाकाहारी)', items: [
      v('Paneer Butter Masala', 'पनीर बटर मसाला', 'Soft paneer in a rich, creamy tomato gravy.', 'मलाईदार टमाटर ग्रेवी में नरम पनीर।', 290, { spice: 1, best: true }),
      v('Dal Makhani', 'दाल मखनी', 'Black lentils slow-cooked overnight with butter and cream.', 'रात भर धीमी आँच पर मक्खन और मलाई के साथ पकी काली दाल।', 240, { spice: 1, chef: true }),
      v('Kadai Paneer', 'कढ़ाई पनीर', 'Paneer with capsicum and freshly ground kadai masala.', 'शिमला मिर्च और ताज़े कढ़ाई मसाले के साथ पनीर।', 280, { spice: 2 }),
      v('Palak Paneer', 'पालक पनीर', 'Paneer cubes in a smooth spinach gravy.', 'मखमली पालक ग्रेवी में पनीर के टुकड़े।', 270, { spice: 1 }),
      v('Mix Veg', 'मिक्स वेज', 'Seasonal vegetables in a home-style masala.', 'घर जैसे मसाले में मौसमी सब्ज़ियाँ।', 220, { spice: 1 }),
      v('Chana Masala', 'छोले मसाला', 'Chickpeas simmered with tangy spices.', 'खट्टे-चटपटे मसालों में पके छोले।', 210, { spice: 2, soldOut: true }),
      { ...v('Jain Dal Tadka', 'जैन दाल तड़का', 'Yellow dal tempered with cumin and ghee. No onion, no garlic.', 'जीरा और घी के तड़के वाली पीली दाल। प्याज़-लहसुन नहीं।', 200, { spice: 1 }), diet: 'jain' },
      { ...v('Jain Mix Veg', 'जैन मिक्स वेज', 'Vegetables in a mild tomato gravy. No onion, no garlic, no root vegetables.', 'हल्की टमाटर ग्रेवी में सब्ज़ियाँ। प्याज़, लहसुन और जड़ वाली सब्ज़ी नहीं।', 230), diet: 'jain' },
    ] },
    { en: 'Main Course (Non-veg)', hi: 'मेन कोर्स (मांसाहारी)', items: [
      n('Butter Chicken', 'बटर चिकन', 'Tandoori chicken in a velvety tomato-butter gravy.', 'मखमली टमाटर-मक्खन ग्रेवी में तंदूरी चिकन।', 340, { spice: 1, best: true }),
      n('Chicken Curry', 'चिकन करी', 'Home-style chicken curry with whole spices.', 'साबुत मसालों वाली घर जैसी चिकन करी।', 300, { spice: 2 }),
      n('Mutton Rogan Josh', 'मटन रोगन जोश', 'Kashmiri-style mutton braised with fennel and dry ginger.', 'सौंफ और सोंठ के साथ पका कश्मीरी अंदाज़ का मटन।', 420, { spice: 3, chef: true }),
      { ...n('Egg Curry', 'अंडा करी', 'Boiled eggs in an onion-tomato masala.', 'प्याज़-टमाटर के मसाले में उबले अंडे।', 220, { spice: 2 }), diet: 'egg' },
    ] },
    { en: 'Breads & Rice', hi: 'रोटी और चावल', items: [
      v('Butter Naan', 'बटर नान', 'Soft tandoor-baked bread brushed with butter.', 'मक्खन लगी नरम तंदूरी नान।', 60),
      v('Garlic Naan', 'गार्लिक नान', 'Naan topped with garlic and coriander.', 'लहसुन और धनिया वाली नान।', 70),
      v('Tandoori Roti', 'तंदूरी रोटी', 'Whole-wheat bread from the tandoor.', 'तंदूर की गेहूँ की रोटी।', 35),
      v('Laccha Paratha', 'लच्छा पराठा', 'Flaky layered whole-wheat paratha.', 'परतदार गेहूँ का पराठा।', 65),
      v('Jeera Rice', 'जीरा राइस', 'Basmati rice tempered with cumin.', 'जीरे के तड़के वाला बासमती चावल।', 160),
      v('Veg Biryani', 'वेज बिरयानी', 'Fragrant basmati layered with vegetables, served with raita.', 'सब्ज़ियों के साथ परतदार ख़ुशबूदार बासमती, रायते के साथ।', 260, { spice: 2, best: true }),
      n('Chicken Biryani', 'चिकन बिरयानी', 'Dum-cooked basmati with tender chicken, served with raita.', 'नरम चिकन के साथ दम पर पका बासमती, रायते के साथ।', 320, { spice: 2, chef: true }),
    ] },
    { en: 'Desserts', hi: 'मिठाई', items: [
      v('Gulab Jamun (2 pcs)', 'गुलाब जामुन (2 पीस)', 'Warm milk dumplings in cardamom syrup.', 'इलायची की चाशनी में गरम गुलाब जामुन।', 80),
      v('Rasmalai (2 pcs)', 'रसमलाई (2 पीस)', 'Soft cottage cheese discs in chilled saffron milk.', 'केसर वाले ठंडे दूध में नरम छेने की टिक्की।', 120),
      v('Gajar Halwa', 'गाजर का हलवा', 'Slow-cooked carrot pudding with nuts.', 'मेवों वाला धीमी आँच पर पका गाजर का हलवा।', 130, { best: true }),
      v('Kulfi Falooda', 'कुल्फी फ़ालूदा', 'Pistachio kulfi with falooda and rose syrup.', 'फ़ालूदा और गुलाब शरबत के साथ पिस्ता कुल्फी।', 140),
    ] },
    { en: 'Beverages', hi: 'पेय', items: [
      v('Sweet Lassi', 'मीठी लस्सी', 'Thick chilled yoghurt drink.', 'गाढ़ी ठंडी दही की लस्सी।', 90, { best: true }),
      v('Masala Chaas', 'मसाला छाछ', 'Spiced buttermilk with roasted cumin.', 'भुने जीरे वाली मसाला छाछ।', 60),
      v('Fresh Lime Soda', 'फ्रेश लाइम सोडा', 'Sweet, salted or mixed.', 'मीठा, नमकीन या मिक्स।', 70),
      v('Masala Chai', 'मसाला चाय', 'Strong tea with ginger and cardamom.', 'अदरक और इलायची वाली कड़क चाय।', 40),
      v('Cold Drink (300 ml)', 'कोल्ड ड्रिंक (300 ml)', 'Assorted soft drinks.', 'अलग-अलग सॉफ़्ट ड्रिंक।', 40),
    ] },
  ],
};

export const CAFE_AROMA: SeedRestaurant = {
  slug: 'cafe-aroma',
  name: 'Cafe Aroma',
  accent: 'teal',
  reviewUrl: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID_CAFE_AROMA',
  tables: 8,
  categories: [
    { en: 'Coffee', hi: 'कॉफ़ी', items: [
      v('Cappuccino', 'कैपुचीनो', 'Espresso with silky steamed milk and foam.', 'एस्प्रेसो के साथ रेशमी स्टीम्ड दूध और झाग।', 180),
      v('Café Latte', 'कैफ़े लाते', 'Smooth and milky, lightly sweet.', 'मुलायम और दूधिया, हल्की मिठास।', 190),
      v('Cold Coffee', 'कोल्ड कॉफ़ी', 'Blended iced coffee with a scoop of ice cream.', 'आइसक्रीम के साथ ब्लेंड की हुई ठंडी कॉफ़ी।', 200, { best: true }),
      v('Filter Coffee', 'फ़िल्टर कॉफ़ी', 'South Indian decoction coffee with frothy milk.', 'झागदार दूध के साथ दक्षिण भारतीय फ़िल्टर कॉफ़ी।', 120, { chef: true }),
      v('Espresso', 'एस्प्रेसो', 'A short, strong shot.', 'छोटा और कड़क शॉट।', 120),
    ] },
    { en: 'Tea', hi: 'चाय', items: [
      v('Masala Chai', 'मसाला चाय', 'Ginger, cardamom and tea, simmered in milk.', 'दूध में उबली अदरक-इलायची वाली चाय।', 80, { best: true }),
      v('Ginger Honey Tea', 'अदरक शहद चाय', 'Warming and soothing, no milk.', 'बिना दूध की गरम और सुकून देने वाली चाय।', 100),
      v('Green Tea', 'ग्रीन टी', 'Light and refreshing.', 'हल्की और ताज़गी भरी।', 100),
      v('Iced Lemon Tea', 'आइस्ड लेमन टी', 'Chilled black tea with lemon and mint.', 'नींबू और पुदीने वाली ठंडी चाय।', 140),
    ] },
    { en: 'Snacks', hi: 'स्नैक्स', items: [
      v('Veg Sandwich', 'वेज सैंडविच', 'Fresh vegetables and mint chutney on toasted bread.', 'टोस्टेड ब्रेड पर ताज़ी सब्ज़ियाँ और पुदीने की चटनी।', 150),
      v('Grilled Cheese Sandwich', 'ग्रिल्ड चीज़ सैंडविच', 'Three cheeses, golden and melty.', 'तीन तरह का चीज़, सुनहरा और पिघला हुआ।', 180, { best: true }),
      n('Chicken Club Sandwich', 'चिकन क्लब सैंडविच', 'Grilled chicken, egg-free mayo and salad in a triple-decker.', 'ग्रिल्ड चिकन, मेयो और सलाद वाला तीन परत का सैंडविच।', 240),
      v('Aloo Tikki Burger', 'आलू टिक्की बर्गर', 'Crisp potato patty with onions and sauces.', 'प्याज़ और सॉस के साथ कुरकुरी आलू टिक्की।', 160),
      v('Peri Peri Fries', 'पेरी पेरी फ्राइज़', 'Crinkle-cut fries tossed in peri peri seasoning.', 'पेरी पेरी मसाले में लिपटे फ्राइज़।', 150, { spice: 2 }),
      v('Veg Maggi', 'वेज मैगी', 'Masala noodles with vegetables.', 'सब्ज़ियों वाली मसाला मैगी।', 120, { best: true, spice: 1 }),
      v('Paneer Wrap', 'पनीर रैप', 'Tandoori paneer, onions and mint mayo in a whole-wheat wrap.', 'गेहूँ के रैप में तंदूरी पनीर, प्याज़ और मिंट मेयो।', 200, { spice: 1 }),
    ] },
    { en: 'Bakery', hi: 'बेकरी', items: [
      v('Chocolate Brownie', 'चॉकलेट ब्राउनी', 'Fudgy brownie with a walnut crunch.', 'अखरोट के कुरकुरेपन वाली फ़ज़ी ब्राउनी।', 140, { chef: true }),
      v('Blueberry Muffin', 'ब्लूबेरी मफ़िन', 'Soft muffin bursting with blueberries.', 'ब्लूबेरी से भरी नरम मफ़िन।', 100),
      v('Butter Croissant', 'बटर क्रोइसां', 'Flaky, buttery and baked fresh daily.', 'परतदार, मक्खनी और रोज़ ताज़ा बेक किया हुआ।', 110),
      v('Red Velvet Slice', 'रेड वेल्वेट स्लाइस', 'Cream cheese frosting on moist red velvet cake.', 'नरम रेड वेल्वेट केक पर क्रीम चीज़ फ्रॉस्टिंग।', 160, { soldOut: true }),
      { ...v('Egg Puff', 'एग पफ़', 'Flaky pastry around a spiced boiled egg.', 'मसालेदार उबले अंडे के चारों ओर परतदार पेस्ट्री।', 80), diet: 'egg' },
    ] },
  ],
};

export const DEMO_RESTAURANTS = [SPICE_GARDEN, CAFE_AROMA];
export const ROLES = ['owner', 'manager', 'waiter', 'kitchen'] as const;
