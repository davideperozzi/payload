import type { FindGlobal } from 'payload/database'
import type { PayloadRequest } from 'payload/types'

import { combineQueries } from 'payload/database'

import type { MongooseAdapter } from './index.js'

import sanitizeInternalFields from './utilities/sanitizeInternalFields.js'
import { withSession } from './withSession.js'

export const findGlobal: FindGlobal = async function findGlobal(
  this: MongooseAdapter,
  { slug, locale, req = {} as PayloadRequest, where },
) {
  const Model = this.globals
  const options = {
    ...withSession(this, req.transactionID),
    lean: true,
  }

  const query = await Model.buildQuery({
    globalSlug: slug,
    locale,
    payload: this.payload,
    where: combineQueries({ globalType: { equals: slug } }, where),
  })

  let doc = await Model.findOne(query, {}, options)

  if (!doc) {
    return null
  }
  if (doc._id) {
    doc.id = doc._id
    delete doc._id
  }

  doc = JSON.parse(JSON.stringify(doc))
  doc = sanitizeInternalFields(doc)

  return doc
}
