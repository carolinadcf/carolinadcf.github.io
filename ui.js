export const UIState = {
    interactionEnabled: false
};

export function initUI() {

    // show ticket preloader
    document.getElementById('ticket-button').addEventListener('click', function () {
        const preloader = document.getElementById('preloader');
        preloader.classList.remove('preloader-animated');
        const preloaderStub = document.getElementById('preloader-stub');
        preloaderStub.classList.remove('stub-animated');

        // show close button
        const closeButton = document.getElementById('close-button');
        closeButton.style.display = 'block';

        // freeze 3D scene interaction when ticket is open
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.pointerEvents = 'none';
            UIState.interactionEnabled = false; // disable raycaster interaction
        }
    });

    // close button
    document.getElementById('close-button').addEventListener('click', function () {
        // hide ticket preloader
        const preloader = document.getElementById('preloader');
        preloader.classList.add('preloader-animated');
        const preloaderStub = document.getElementById('preloader-stub');
        preloaderStub.classList.add('stub-animated');

        // hide close button
        const closeButton = document.getElementById('close-button');
        closeButton.style.display = 'none';

        // enable 3D scene interaction when ticket is closed
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            UIState.interactionEnabled = true; // enable raycaster interaction
        }
    });

    // show about me
    document.getElementById('about-me-button').addEventListener('click', function () {
        const aboutMeSection = document.getElementById('about-me-section');
        aboutMeSection.style.display = 'flex';

        // show close button
        const closeButton = document.getElementById('close-about-me');
        closeButton.style.display = 'block';

        // freeze 3D scene interaction when about me is open
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.pointerEvents = 'none';
            UIState.interactionEnabled = false; // disable raycaster interaction
        }
    });

    // close about me
    document.getElementById('close-about-me').addEventListener('click', function () {
        const aboutMeSection = document.getElementById('about-me-section');
        aboutMeSection.style.display = 'none';

        // hide close button
        const closeButton = document.getElementById('close-about-me');
        closeButton.style.display = 'none';

        // enable 3D scene interaction when about me is closed
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            UIState.interactionEnabled = true; // enable raycaster interaction
        }
    });

    // book animation
    // https://codepen.io/captain_anonym0us/pen/ybVbpv
    var pages = document.getElementsByClassName('page');
    for(var i = 0; i < pages.length; i++)
    {
        var page = pages[i];
        if (i % 2 === 0)
        {
            page.style.zIndex = (pages.length - i);
        }
    }
    
    // add onclick events to each page
    for(var i = 0; i < pages.length; i++) {
        //Or var page = pages[i];
        pages[i].pageNum = i + 1;
        pages[i].onclick=function()
            {
            if (this.pageNum % 2 === 0)
                {
                this.classList.remove('flipped');
                this.previousElementSibling.classList.remove('flipped');
                }
            else
                {
                this.classList.add('flipped');
                if (this.nextElementSibling) {
                    this.nextElementSibling.classList.add('flipped');
                }
                }
            }
        }
    // end of book animation
    
    UIState.interactionEnabled = true;
}