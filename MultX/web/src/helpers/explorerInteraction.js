export const getInteractiveRowProps = ({ onActivate, label }) => ({
  tabIndex: 0,
  'data-interactive-row': 'true',
  'aria-label': label,
  title: label,
  onClick: onActivate,
  onKeyDown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  }
});
