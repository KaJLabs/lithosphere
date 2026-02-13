/**
 * Sidebar collapse/expand enhancement for Docsify.
 * Adds collapsible section headers in the sidebar navigation.
 */
(function () {
  function initSidebarCollapse() {
    var sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;

    var sections = sidebar.querySelectorAll('ul > li > strong');
    sections.forEach(function (heading) {
      var parent = heading.parentElement;
      var sublist = parent.querySelector('ul');
      if (!sublist) return;

      heading.style.cursor = 'pointer';
      heading.setAttribute('role', 'button');
      heading.setAttribute('aria-expanded', 'true');

      heading.addEventListener('click', function () {
        var isCollapsed = sublist.style.display === 'none';
        sublist.style.display = isCollapsed ? '' : 'none';
        heading.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        heading.classList.toggle('collapsed', !isCollapsed);
      });
    });
  }

  // Re-initialize on route change
  if (window.$docsify) {
    window.$docsify.plugins = (window.$docsify.plugins || []).concat(
      function (hook) {
        hook.doneEach(function () {
          initSidebarCollapse();
        });
      }
    );
  }
})();
