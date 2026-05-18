f=open('templates/index.html','w',encoding='utf-8')
f.write(open('templates/index.html').read())
f.close()
print(len(open('templates/index.html').read()))
