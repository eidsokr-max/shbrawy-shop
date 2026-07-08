import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// عنوان بيتك عند جوجل (مفتاح الربط)
const firebaseConfig = {
  apiKey: "AIzaSyCGJQVtLATT1yFdkR58JyTxJ0kbQhnLVRg",
  authDomain: "shbrawy-shop.firebaseapp.com",
  projectId: "shbrawy-shop",
  storageBucket: "shbrawy-shop.firebasestorage.app",
  messagingSenderId: "619982205483",
  appId: "1:619982205483:web:cab9426ce2888220ef306e",
  measurementId: "G-VEWYWQM3XF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// كود الإضافة (شغال في صفحة admin.html)
const form = document.getElementById('add-device-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "products"), {
            brand: document.getElementById('brand').value,
            model: document.getElementById('model').value,
            price: document.getElementById('price').value
        });
        alert("تم الحفظ!");
        form.reset();
    });
}

// كود العرض (شغال في صفحة index.html)
const display = document.getElementById('products-list');
if (display) {
    const querySnapshot = await getDocs(collection(db, "products"));
    display.innerHTML = ""; 
    querySnapshot.forEach((doc) => {
        const p = doc.data();
        display.innerHTML += `<div><h3>${p.brand} - ${p.model}</h3><p>${p.price} جنيه</p></div><hr>`;
    });
}
