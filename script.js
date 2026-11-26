const PAGE_FRAGMENTS = {
    home: "pages/home.html",
    about: "pages/about.html",
    team: "pages/meet-the-mentors.html",
    calendar: "pages/calendar.html",
    biobuzz: "pages/bio-buzz.html",
    resources: "pages/resources.html",
    scouting: "pages/scouting.html",
    contact: "pages/contact.html",
};

const UPCOMING_EVENTS_URL = "data/upcoming-events.json";

const MENTORS = [
    { name: "Tej Shah", role: "Head Coach", img: "assets/mugshots/Tej-Shah.jpg", description: "Tej Shah is the Head Coach of the team, guiding and managing the team through various tasks." },
    { name: "Yutong Zhu", role: "Lead Software", img: "assets/mugshots/Yutong-Zhu.jpg" },
    { name: "Leonardo Luna", role: "Lead Mechanical", img: "assets/mugshots/Leonardo-Luna.jpg" },
    { name: "Max Zamora", role: "Lead Mechanical", img: "assets/mugshots/Max-Zamora.jpg" },
    { name: "Jayden Mendoza", role: "Lead Media", img: "assets/mugshots/Jayden Mendoza.png" },
    { name: "Gavin Cook", role: "Mentor", img: "" },
    { name: "Jhon Odle", role: "Mentor", img: "" },
];

function buildMentorCards() {
    const grid = document.getElementById("mentor-grid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (!document.getElementById("mentorDetailModal")) {
        const modal = document.createElement("div");
        modal.id = "mentorDetailModal";
        modal.className = "mentor-detail-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <div class="mentor-detail-card" role="dialog" aria-modal="true" aria-labelledby="mentorDetailName">
                <button type="button" class="mentor-detail-close" aria-label="Close mentor details">&times;</button>
                <img class="mentor-detail-avatar" id="mentorDetailAvatar" alt="">
                <div>
                    <div class="team-role" id="mentorDetailRole"></div>
                    <h3 id="mentorDetailName"></h3>
                    <p id="mentorDetailDescription"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => {
            modal.hidden = true;
            document.body.classList.remove("mentor-modal-open");
        };

        modal.querySelector(".mentor-detail-close").addEventListener("click", closeModal);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !modal.hidden) closeModal();
        });
    }

    for (const mentor of MENTORS) {
        const card = document.createElement("div");
        card.className = "team-card";

        let avatar;
        if (mentor.img) {
            avatar = document.createElement("img");
            avatar.className = "team-avatar";
            avatar.src = mentor.img;
            avatar.alt = mentor.name;
        } else {
            avatar = document.createElement("div");
            avatar.className = "team-avatar-initials";
            avatar.setAttribute("aria-label", mentor.name);
            avatar.textContent = mentor.name
                .split(" ")
                .map((part) => part[0])
                .join("");
        }

        const name = document.createElement("div");
        name.className = "team-name";
        name.textContent = mentor.name;

        const role = document.createElement("div");
        role.className = "team-role";
        role.textContent = mentor.role;

        card.append(avatar, name, role);

        if (mentor.description) {
            card.tabIndex = 0;
            card.setAttribute("role", "button");
            card.setAttribute("aria-label", `More about ${mentor.name}`);
            card.classList.add("team-card-interactive");

            const openMentorDetail = () => {
                const modal = document.getElementById("mentorDetailModal");
                document.getElementById("mentorDetailAvatar").src = mentor.img;
                document.getElementById("mentorDetailAvatar").alt = mentor.name;
                document.getElementById("mentorDetailRole").textContent = mentor.role;
                document.getElementById("mentorDetailName").textContent = mentor.name;
                document.getElementById("mentorDetailDescription").textContent = mentor.description;
                modal.hidden = false;
                document.body.classList.add("mentor-modal-open");
                modal.querySelector(".mentor-detail-close").focus();
            };

            card.addEventListener("click", openMentorDetail);
            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openMentorDetail();
                }
            });
        }

        grid.appendChild(card);
    }
}

function parseEventDate(value) {
    return new Date(`${value}T00:00:00`);
}

function formatEventDate(value) {
    const date = parseEventDate(value);

    return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

async function renderUpcomingEvents() {
    const grid = document.getElementById("upcoming-events-grid");

    if (!grid) {
        return;
    }

    grid.innerHTML = '<div class="events-empty">Loading upcoming events.</div>';

    try {
        const response = await fetch(UPCOMING_EVENTS_URL, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Failed to load ${UPCOMING_EVENTS_URL}`);
        }

        const events = await response.json();
        const now = new Date();

        const upcomingEvents = events
            .map((event) => ({
                ...event,
                startDate: parseEventDate(event.date),
            }))
            .filter((event) => event.startDate >= now)
            .sort((first, second) => first.startDate - second.startDate);

        if (!upcomingEvents.length) {
            grid.innerHTML = '<div class="events-empty">No upcoming events are currently listed on the team calendar.</div>';
            return;
        }

        const cardsFragment = document.createDocumentFragment();

        upcomingEvents.forEach((event, index) => {
            const isNext = index === 0;
            const card = document.createElement("article");
            const badge = document.createElement("div");
            const date = document.createElement("div");
            const title = document.createElement("div");
            const meta = document.createElement("div");

            card.className = `event-card${isNext ? " event-card--next" : ""}`;

            badge.className = "event-badge";
            badge.textContent = isNext ? "Next up" : `Event ${index + 1}`;

            date.className = "event-date";
            date.textContent = formatEventDate(event.date);

            title.className = "event-title";
            title.textContent = event.title;

            meta.className = "event-meta";
            meta.textContent = `${event.allDay ? "All day" : "Scheduled time"}${event.location ? ` · ${event.location}` : ""}`;

            card.appendChild(badge);
            card.appendChild(date);
            card.appendChild(title);
            card.appendChild(meta);
            cardsFragment.appendChild(card);
        });

        grid.replaceChildren(cardsFragment);
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<div class="events-empty">The upcoming-events list could not be loaded.</div>';
    }
}

async function loadFragment(pageName, fragmentPath) {
    const page = document.getElementById(`page-${pageName}`);

    if (!page) {
        return;
    }

    const response = await fetch(fragmentPath);

    if (!response.ok) {
        throw new Error(`Failed to load ${fragmentPath}`);
    }

    page.innerHTML = await response.text();
}

function refreshCalendarEmbed() {
    const calendar = document.getElementById("team-calendar");

    if (!calendar) {
        return;
    }

    const url = new URL(calendar.src);
    url.searchParams.set("refresh", Date.now().toString());
    calendar.src = url.toString();
}

function showPage(pageName) {
    const pages = document.querySelectorAll(".page");
    for (const page of pages) {
        page.classList.remove("active");
    }

    const links = document.querySelectorAll(".nav-links a");
    for (const link of links) {
        link.classList.remove("active");
    }

    const selectedPage = document.getElementById(`page-${pageName}`);
    const selectedLink = document.querySelector(`.nav-links a[data-page="${pageName}"]`);

    if (selectedPage) {
        selectedPage.classList.add("active");
    }

    if (selectedLink) {
        selectedLink.classList.add("active");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageName === "calendar") {
        renderUpcomingEvents();
    }

    if (pageName === "scouting" && window.initScoutingApp) {
        window.initScoutingApp();
    }

    triggerReveal();
}

function triggerReveal() {
    setTimeout(() => {
        const elements = document.querySelectorAll(".page.active .reveal");
        for (const element of elements) {
            element.classList.add("visible");
        }
    }, 80);
}

function getPageNameFromHash() {
    const hash = window.location.hash.slice(1).toLowerCase();
    return hash && Object.hasOwn(PAGE_FRAGMENTS, hash) ? hash : "home";
}

function navigateTo(pageName) {
    // Update URL hash to sync page state with browser history
    if (pageName !== "home") {
        window.location.hash = pageName;
    } else {
        // Remove hash for home page (cleaner URL)
        window.history.pushState(null, "", window.location.pathname);
    }

    // showPage will be called by hashchange event listener
    // For home, manually call showPage since pushState doesn't trigger hashchange
    if (pageName === "home") {
        showPage(pageName);
    }
}

function wireNavigation() {
    const links = document.querySelectorAll(".nav-links a[data-page], .nav-logo[data-page]");

    for (const link of links) {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            navigateTo(link.dataset.page);
        });
    }

    // Handle hash changes (from back/forward buttons or direct hash navigation)
    window.addEventListener("hashchange", () => {
        const pageName = getPageNameFromHash();
        showPage(pageName);
    });

    document.addEventListener("click", (event) => {
        if (event.target.closest("#calendar-refresh")) {
            refreshCalendarEmbed();
            renderUpcomingEvents();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && getPageNameFromHash() === "calendar") {
            refreshCalendarEmbed();
            renderUpcomingEvents();
        }
    });
}

async function init() {
    wireNavigation();

    const fragmentEntries = Object.entries(PAGE_FRAGMENTS);
    const fragmentResults = await Promise.allSettled(
        fragmentEntries.map(([pageName, fragmentPath]) => loadFragment(pageName, fragmentPath))
    );

    fragmentResults.forEach((result, index) => {
        if (result.status === "rejected") {
            const [pageName, fragmentPath] = fragmentEntries[index];
            console.error(`Failed to load fragment "${pageName}" from "${fragmentPath}"`, result.reason);
        }
    });

    buildMentorCards();
    await renderUpcomingEvents();

    if (window.initScoutingApp) {
        window.initScoutingApp();
    }

    // Load the page based on the initial hash (enables deep-linking)
    const pageName = getPageNameFromHash();
    showPage(pageName);
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
        console.error(error);
    });
});