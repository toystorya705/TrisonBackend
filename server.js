const axios = require("axios");

const endpointURL =
  "https://deliverect.trison.uk/places/9yYn6aC35L942ABGypUSz5.json";
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccount.json");
const { start } = require("@craco/craco/lib/cra");
const accountId = "Px2KE6udMlyOGVoQzFdw";
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://trison-api-fetch-store.firebaseio.com",
});
const firestore = admin.firestore();
//to avoid reupload of duplicate product in particular run
let itemsListIds = new Map();
let globalApiData = {};
const allergenData = {
  Celery: false,
  Crustaceans: false,
  Eggs: false,
  Fish: false,
  Gluten: false,
  Milk: false,
  Molluscs: false,
  Mustard: false,
  Nuts: false,
  Peanuts: false,
  Sesame: false,
  Soybeans: false,
  Sulphites: false,
};
const initialNutritionData = {
  weight: { value: 0, unit: "g" },
  energykj: { value: 0, unit: "kJ" },
  energykcal: { value: 0, unit: "kcal" },
  protein: { value: 0, unit: "g" },
  carbohydrate: { value: 0, unit: "g" },
  sugars: { value: 0, unit: "g" },
  fat: { value: 0, unit: "g" },
  saturates: { value: 0, unit: "g" },
  fibre: { value: 0, unit: "g" },
  sodium: { value: 0, unit: "mg" },
  salt: { value: 0, unit: "g" },
};
//fetch data from endpoint
async function fetchData() {
  try {
    const response = await axios.get(endpointURL);
    return response.data; // This will be the JSON data
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

async function main() {
  const data = await fetchData();
  if (data) {
    //Setting up global variable to access while working on products
    globalApiData = data[0];
    console.log("start");
    await storeMenu(data[0].categories);
    console.log("finish");

    //clearing the list
    itemsListIds.clear();
  }
}
//Menu Categories -> products-> modifiers->itemType 
//                                       ->priceList 
//////Menu Data
async function storeMenu(menuData) {
  try {
    const menusRef = firestore.collection("Menu");

    for (const menu of menuData) {
      let customMenu = menu;

      const docRef = menusRef.doc(menu._id);
      const createdAt = new Date();
      //calling the product before storing menu
      await storeItems(menu.products);

      customMenu = {
        accountId: accountId,
        active: true,
        attributeData: {
          menuName: menu.menu,
          menuId: menu.deliverectMenuID || "",
          subProductSortOrder: menu.subProductSortOrder || null,
        },
        created: createdAt.toISOString(),
        details: menu.description || "",
        image: menu.imageUrl || "",
        listData: menu.products,
        modified: "",
        name: menu.menu,
      };
      await docRef.set(customMenu);
   
    }
  } catch (error) {
    console.error("Error in storeMenu:", error);
  }
}

//////Menu Data

async function storeItems(itemIds) {
  const itemRef = firestore.collection("Items");

  for (const itemId of itemIds) {
    try {
      //check if already uploaded in current session then ignore
      if (!itemsListIds.has(itemId)) {
        const item = globalApiData.products[itemId];
        const createdAt = new Date();
        let itemTypeId = "";
        const docRef = itemRef.doc(itemId);
        //Check if modifierGroup exist
        if (item.subProducts) {
          let sizes = getSizeDataWithPriceFromModifiers(
            item.subProducts,
            item.price
          );
          //using subproduct id as itemtype id
          itemTypeId = item.subProducts[0];
          await createItemType(sizes, itemTypeId, item);
          await createPriceList(sizes, itemTypeId, item);
        }

        let customItem = item;
        customItem = {
          accountId: accountId,
          active: true,
          attributeData: {
            deliverectPLU: item.plu || "",
            soldOut: false,
            referenceId: item.referenceId,
            snoozed: item.snoozed,
            deliveryTax: item.deliveryTax,
            itemName: "",
            itemNo: "",
            multiply: item.multiply,
            isVariant: item.isVariant || false,
          },
          created: createdAt,
          details: item.description || "",
          id: item._id, // Firebase ID
          image: item.imageUrl,
          importId: "",
          itemTypeId: itemTypeId, // Firebase ID
          modified: "",
          name: item.name,
          nutritionData: updateNutritionDataFromString(
            initialNutritionData,
            item.description || ""
          ), //Extracting the data from description string
          allergenData: updateAllergenDataBasedOnString(
            item.description || "",
            allergenData
          ), //Extracting the data from description string
        };

        await docRef.set(customItem);
        //set current item to avoid reupload in the current session
        itemsListIds.set(itemId, "");
      }
    } catch (error) {
      console.error("Error storing items:", error);
    }
  }
}
async function createItemType(itemTypeData, id, itemData) {
  try {
    const customData = {
      accountId: accountId,
      active: true,
      created: new Date(),
      modified: "",
      details: "different sizes",
      name: itemData.name,
      sizes: itemTypeData.map(({ size }) => size),
    };

    return await firestore.collection("ItemTypes").doc(id).set(customData);
  } catch (error) {
    console.error("Error in createItemType:", error);
  }
}
async function createPriceList(itemTypeData, id, itemData) {
  try {
  const customData = {
    accountId: accountId,
    created: new Date(),
    modified: "",
    details: "different prices",
    name: itemData.name,
    prices: itemTypeData.map(({ price }) =>
      price !== undefined ? price : null
    ),
  };
  return await firestore.collection("Pricelist").doc(id).set(customData);
} catch (error) {
  console.error("Error in createPriceList:", error);
}
}

function updateAllergenDataBasedOnString(inputString, allergenData) {
  //this is a custom text array egg instead of eggs
  const CustomText = [
    "Celery",
    "Crustaceans",
    "Egg",
    "Fish",
    "Gluten",
    "Milk",
    "Molluscs",
    "Mustard",
    "Nut",
    "Peanut",
    "Sesame",
    "Soybean",
    "Sulphite",
  ];
  //this array is for key
  const allergenKeys = [
    "Celery",
    "Crustaceans",
    "Eggs",
    "Fish",
    "Gluten",
    "Milk",
    "Molluscs",
    "Mustard",
    "Nuts",
    "Peanuts",
    "Sesame",
    "Soybeans",
    "Sulphites",
  ];

  const lowercaseInput = inputString.toLowerCase();

  for (let i = 0; i < allergenKeys.length; i++) {
    const key = allergenKeys[i];
    allergenData[key] = lowercaseInput.includes(CustomText[i].toLowerCase());
  }

  return allergenData;
}
function getSizeDataWithPriceFromModifiers(subProductsIds) {
  let sizeArr = [];
  //extracting sizes from description of modifiers and returning object array
  for (const groupId of globalApiData.modifierGroups[subProductsIds[0]]
    .subProducts) {
    const tempObj = globalApiData.modifiers[groupId];
    const name = tempObj.name.toLowerCase();
    if (name.includes("small"))
      sizeArr.push({ size: "small", price: tempObj.price });
    else if (name.includes("regular") || name.includes("regular"))
      sizeArr.push({ size: "regular", price: tempObj.price });
    else if (name.includes("large"))
      sizeArr.push({ size: "large", price: tempObj.price });
  }

  return sizeArr;
}

function parseNutritionValue(nutritionString, pattern) {
  const matches = nutritionString.match(pattern);
  if (matches) {
    const numericValue = parseFloat(matches[1]);
    const unit = matches[2];
    return `${numericValue}${unit}`;
  }
  return null;
}

function updateNutritionDataFromString(nutritionData, nutritionString) {
  const nutritionFieldConfig = {
    weight: /(\d+)\s*(g)/,
    energykj: /(\d+)\s*(kJ)/,
    energykcal: /(\d+)\s*(kcal)/,
    protein: /(\d+)\s*(g)/,
    carbohydrate: /(\d+)\s*(g)/,
    sugars: /(\d+)\s*(g)/,
    fat: /(\d+)\s*(g)/,
    saturates: /(\d+)\s*(g)/,
    fibre: /(\d+)\s*(g)/,
    sodium: /(\d+)\s*(mg)/,
    salt: /(\d+)\s*(g)/,
  };

  for (const field in nutritionFieldConfig) {
    if (nutritionFieldConfig.hasOwnProperty(field)) {
      const pattern = nutritionFieldConfig[field];
      const parsedValue = parseNutritionValue(
        nutritionString.toLowerCase(),
        pattern
      );
      nutritionData[field] = parsedValue !== null ? parsedValue : "";
    }
  }

  return nutritionData;
}
// Set up an interval of 40sec to fetch and store data
setInterval(main, 40000);

