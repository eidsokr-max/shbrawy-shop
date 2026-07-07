let productsData = JSON.parse(localStorage.getItem('myPhones')) || {
    samsung: [], iphone: [], infinix: [], oppo: []
};

function addNewPhone() {
    let name = document.getElementById('new-name').value;
    let price = document.getElementById('new-price').value;
    let folder = document.getElementById('new-folder').value;
    let cat = document.getElementById('new-cat').value;
    
    if(name && price && folder) {
        productsData[cat].push({name, price, folder, status: "زيرو", notes: "بحالة ممتازة"});
        localStorage.setItem('myPhones', JSON.stringify(productsData));
        
        // مسح الخانات بعد الإضافة
        document.getElementById('new-name').value = "";
        document.getElementById('new-price').value = "";
        document.getElementById('new-folder').value = "";
        alert("تم إضافة الجهاز بنجاح!");
    } else {
        alert("من فضلك املأ كل البيانات");
    }
}

// دالة حذف الجهاز
function deletePhone(cat, index) {
    if(confirm("هل أنت متأكد إن الموبايل اتباع وعايز تحذفه؟")) {
        productsData[cat].splice(index, 1);
        localStorage.setItem('myPhones', JSON.stringify(productsData));
        document.getElementById('product-modal').style.display = 'none';
        showCategory(cat); // تحديث القائمة
    }
}

function showCategory(cat) {
    document.getElementById('category-grid').style.display = 'none';
    document.getElementById('product-display').style.display = 'block';
    document.getElementById('cat-title').innerText = "موبايلات " + cat.toUpperCase();
    let list = document.getElementById('product-list');
    list.innerHTML = "";
    productsData[cat].forEach((p, index) => {
        list.innerHTML += `<div class="product-card">
            <img src="images/${p.folder}/front.jpg" style="width:100%; height:100px; object-fit:cover; border-radius:10px;">
            <h3>${p.name}</h3>
            <p>${p.price} ج.م</p>
            <button class="details-btn" onclick="openDetails('${cat}', ${index})">التفاصيل</button>
        </div>`;
    });
}

function openDetails(cat, index) {
    let p = productsData[cat][index];
    let modal = document.getElementById('product-modal');
    document.getElementById('modal-body').innerHTML = `
        <span onclick="document.getElementById('product-modal').style.display='none'" style="cursor:pointer; color:red;">إغلاق X</span>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin:15px 0;">
            <img src="images/${p.folder}/front.jpg" style="width:100%; border-radius:5px;">
            <img src="images/${p.folder}/back.jpg" style="width:100%; border-radius:5px;">
        </div>
        <h2>${p.name}</h2>
        <p>السعر: ${p.price} ج.م</p>
        <button class="delete-btn" onclick="deletePhone('${cat}', ${index})" style="background:red; color:white; border:none; padding:10px; margin-top:10px; border-radius:5px; cursor:pointer;">حذف الجهاز (تم البيع)</button>
    `;
    modal.style.display = 'block';
}

function backToHome() {
    document.getElementById('category-grid').style.display = 'grid';
    document.getElementById('product-display').style.display = 'none';
}
