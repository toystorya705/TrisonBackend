const axios = require('axios');

const endpointURL = 'https://deliverect.trison.uk/places/9yYn6aC35L942ABGypUSz5.json';
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccount.json'); 
const accountId="Px2KE6udMlyOGVoQzFdw";
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://trison-api-fetch-store.firebaseio.com'
});
const firestore = admin.firestore();



async function fetchData() {
  try {
    const response = await axios.get(endpointURL);
    return response.data; // This will be the JSON data
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

async function main() {
  const data = await fetchData();
  if (data) {
    // console.log('Fetched Data:', data[0].products);
    // storeItemTypes(data[0].products);
    storeMenu(data[0].categories);
  }
}
async function storeMenu(menuData) {
    const menusRef = firestore.collection('Menu');
    let iterationCount = 0;
    console.log("store menu start")


    for (const menu of menuData) {
        let  customMenu = menu;
    
        const docRef = menusRef.doc(menu._id); 
        const createdAt = new Date(); 

        customMenu= {
            accountId: accountId,
            active: true,
            attributeData: {  
               menu:menu.menu,
                subProductSortOrder:menu.subProductSortOrder,
                subProducts:menu.subProducts
            },
            created: createdAt.toISOString(), // Timestamp
            details: null,
            image: null,
            listData: [...menu.products],
            modified: '', // Timestamp
            name:  menu.name
        }
        
        await docRef.set(customMenu);
    
        console.log(`Added/updated document with custom ID: ${menu._id}`);
    
        iterationCount++;
        if (iterationCount === 2) {
          break; // Stop the loop after three iterations
        }
    }
    
    console.log("store menu Finish")

  }

async function storeItemTypes(itemTypesData) {
    const itemTypesRef = firestore.collection('ItemTypes');
    console.log("storeItemTypes start")
    let iterationCount = 0;

    for (const key in itemTypesData) {
        if (itemTypesData.hasOwnProperty(key)) {
            const itemType = itemTypesData[key];
            const docRef = itemTypesRef.doc(key);
      
              await docRef.set(itemType);
              console.log(`Added document with key: ${key}`);
        }
        iterationCount++;
        if (iterationCount === 2) {
          break; // Stop the loop after three iterations
        }
      }
    console.log("storeItemTypes Finish")
  }

main();