import express from 'express'
import { companiaRouter } from './src/Compania/compania.routes.js'
import { categoriaRouter } from './src/Categoria/categoria.routes.js'
import { servicioRouter } from './src/Producto/Servicio/servicio.routes.js'
import 'reflect-metadata'
import { orm, syncSchema } from './src/shared/orm.js'
import { RequestContext } from '@mikro-orm/core'
const app = express()
app.use(express.json())

//luego de los middlewares base
app.use((req, res, next) => {
  RequestContext.create(orm.em, next)
})
//antes de las rutas y middlewares de negocio

app.use('/api/compania', companiaRouter)
app.use('/api/categoria', categoriaRouter)
app.use('/api/servicio',servicioRouter)

app.use((_, res) => {
  res.status(404).send({ message: 'Resource not found' })
  return
})

await syncSchema() //nunca en producción

app.listen(3000, () => {
  console.log('Server runnning on http://localhost:3000/')
})
