// كود عرض المنتجات (بيشتغل في الصفحة الرئيسية)
function displayProducts() {
    let devices = JSON.parse(localStorage.getItem('devices')) || [];
    let display = document.getElementById('products-display');
    if (display) {
        display.innerHTML = devices.map(d => `
            <div style="border:1px solid #333; padding:15px; margin:10px; border-radius:10px;">
                <h3>النوع: ${d.category}</h3>
                <p>الموديل: ${d.model}</p>
            </div>
        `).join('');
    }
}

// كود إضافة الأجهزة (بيشتغل في صفحة الإدارة)
const form = document.getElementById('add-device-form');
if (form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        let category = document.getElementById('category').value;
        let model = document.getElementById('model').value;
        
        let devices = JSON.parse(localStorage.getItem('devices')) || [];
        devices.push({ category, model });
        localStorage.setItem('devices', JSON.stringify(devices));
        
        alert('تم إضافة الجهاز بنجاح يا أبو آدم!');
        form.reset();
    });
}

// تشغيل عرض المنتجات بمجرد فتح الصفحة
window.onload = displayProducts;
