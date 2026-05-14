
const floatingMenu = document.querySelector('.floating-menu');
const helmetBtn = document.querySelector('.helmet-btn');

helmetBtn.addEventListener('click', ()=>{
  floatingMenu.classList.toggle('open');
});

window.addEventListener('click', (e)=>{
  if(!floatingMenu.contains(e.target)){
    floatingMenu.classList.remove('open');
  }
});
