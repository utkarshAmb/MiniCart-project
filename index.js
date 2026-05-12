const cart = [];  // lives outside everything, at the top of your js file
let data = [];
fetch('./product_data.json')
    .then(response => response.json())
    .then(json => {
        data = json;
        updateContent();
    })
    .catch(error => console.error('Error:', error));


function updateContent() {
    const template = document.getElementById('product-card-template');

    data.forEach(element => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.product-card');
        card.setAttribute('data-id', element.id);
        clone.querySelector('.product-card>img').setAttribute('src', element.image);
        clone.querySelector('.product-card>h4').textContent = element.title;
        clone.querySelector('.product-card>.price').textContent = element.price_cents;

        clone.querySelector('.add').addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            addToCart(id);
        });
        document.getElementById('products').appendChild(clone);
    });
}


function addToCart(id) {
    const existing = cart.find(item => item.id === id);

    if (existing) {
        existing.quantity += 1;  // already in cart, just increment
    } else {
        const product = data.find(p => p.id === id);
        cart.push({ ...product, quantity: 1 });  // add new entry
    }

    renderCart();
}


function renderCart() {
    const cartContainer = document.querySelector('.cart-area');
    cartContainer.innerHTML = '';  // clear and re-render fresh each time

    cart.forEach(item => {
        const div = document.createElement('div');
        div.textContent = `${item.title} x${item.quantity} — $${(item.price_cents * item.quantity / 100).toFixed(2)}`;
        cartContainer.appendChild(div);
    });
}
