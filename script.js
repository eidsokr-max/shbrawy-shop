// كود بسيط يشغل الموقع ويحفظ الداتا في المتصفح أونلاين
document.getElementById('add-device-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    let device = {
        name: document.getElementById('name').value,
        price: document.getElementById('price').value,
        folder: document.getElementById('folder').value,
        category: document.getElementById('category').value
    };

    let devices = JSON.parse(localStorage.getItem('shbrawy_data') || '[]');
    devices.push(device);
    localStorage.setItem('shbrawy_data', JSON.stringify(devices));
    
    alert("تم إضافة الجهاز يا أبو آدم!");
    window.location.reload(); // تحديث الصفحة عشان تظهر
});

function displayProducts() {
    let devices = JSON.parse(localStorage.getItem('shbrawy_data') || '[]');
    let display = document.getElementById('products-display');
    // هنا كود عرض الأجهزة
}
