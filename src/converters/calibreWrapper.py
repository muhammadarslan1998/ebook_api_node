import sys
import bs4
import bs4.element

# Fix BeautifulSoup 4.14.x bug where _last_descendant / descendants crashes
# when tree pointers (previous_element / next_sibling) are None or mutated during parsing
def safe_last_descendant(self, is_initialized=True, accept_self=True):
    last_child = None
    if is_initialized and self.next_sibling is not None:
        last_child = getattr(self.next_sibling, 'previous_element', None)
    if last_child is None:
        last_child = self
        while isinstance(last_child, bs4.element.Tag) and getattr(last_child, 'contents', None):
            last_child = last_child.contents[-1]
    if not accept_self and last_child is self:
        last_child = None
    return last_child

bs4.element.Tag._last_descendant = safe_last_descendant

@property
def safe_descendants(self):
    if not len(getattr(self, 'contents', [])):
        return
    last_descendant = self._last_descendant(accept_self=True)
    if last_descendant is None:
        for child in self.contents:
            yield child
            if isinstance(child, bs4.element.Tag):
                yield from child.descendants
        return
    stopNode = getattr(last_descendant, 'next_element', None)
    current = self.contents[0]
    while current is not stopNode:
        if current is None:
            return
        successor = getattr(current, 'next_element', None)
        yield current
        current = successor

bs4.element.Tag.descendants = safe_descendants

from calibre.ebooks.conversion.cli import main

if __name__ == '__main__':
    args = ['ebook-convert'] + sys.argv[1:]
    sys.exit(main(args))
