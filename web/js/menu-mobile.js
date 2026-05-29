document.addEventListener(
    "DOMContentLoaded",
    () => {

        const btn =
            document.querySelector(
                ".mobile-menu-btn"
            );

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        const overlay =
            document.querySelector(
                ".mobile-overlay"
            );

        if (
            !btn ||
            !sidebar ||
            !overlay
        ) {
            return;
        }

        btn.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "open"
                );

                overlay.classList.toggle(
                    "show"
                );

            }
        );

        overlay.addEventListener(
            "click",
            () => {

                sidebar.classList.remove(
                    "open"
                );

                overlay.classList.remove(
                    "show"
                );

            }
        );

    }
);