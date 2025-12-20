import sys
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texts = []
        self.current_tag = None
    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        if tag in {"p","li","h1","h2","h3","h4","th","td","code"}:
            self.texts.append("")
    def handle_endtag(self, tag):
        self.current_tag = None
    def handle_data(self, data):
        if self.current_tag in {"p","li","h1","h2","h3","h4","th","td","code"}:
            if self.texts:
                self.texts[-1] += data.strip() + " "

for path in sys.argv[1:]:
    parser = TextExtractor()
    with open(path, encoding='utf-8') as f:
        parser.feed(f.read())
    print(f"==== {path} ====")
    for line in parser.texts:
        line = line.strip()
        if line:
            print(line)
